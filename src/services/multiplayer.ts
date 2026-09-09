import { supabase, isSupabaseConfigured } from './supabase';
import type { GameMode, PlayerState, RealtimeMessage, RoomState, ScoreUpdatePayload, UserProfile } from '../types/game';
import { leaderboard } from './leaderboard';

type RoomCallback = (room: RoomState) => void;
type ScoreCallback = (payload: ScoreUpdatePayload) => void;
type MatchFinishedCallback = (winnerId: string | null, reason: string) => void;
type SuddenDeathCallback = (lockedUserId: string, targetScore: string) => void;
type OpponentQuitCallback = () => void;
type LatencyCallback = (ms: number) => void;

class MultiplayerService {
  private currentRoom: RoomState | null = null;
  private currentUserId: string = '';
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;

  // Listeners
  private roomCallbacks: Set<RoomCallback> = new Set();
  private scoreCallbacks: Set<ScoreCallback> = new Set();
  private finishCallbacks: Set<MatchFinishedCallback> = new Set();
  private suddenDeathCallbacks: Set<SuddenDeathCallback> = new Set();
  private quitCallbacks: Set<OpponentQuitCallback> = new Set();
  private latencyCallbacks: Set<LatencyCallback> = new Set();

  private pingInterval: any = null;
  private blitzInterval: any = null;
  private suddenDeathInterval: any = null;

  // Generate 6-char room code like DUEL42 or A7X9P2
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public getCurrentRoom(): RoomState | null {
    return this.currentRoom;
  }

  public getCurrentUserId(): string {
    return this.currentUserId;
  }

  // Event subscription helpers
  public onRoomUpdated(cb: RoomCallback) {
    this.roomCallbacks.add(cb);
    return () => this.roomCallbacks.delete(cb);
  }

  public onOpponentScore(cb: ScoreCallback) {
    this.scoreCallbacks.add(cb);
    return () => this.scoreCallbacks.delete(cb);
  }

  public onMatchFinished(cb: MatchFinishedCallback) {
    this.finishCallbacks.add(cb);
    return () => this.finishCallbacks.delete(cb);
  }

  public onSuddenDeath(cb: SuddenDeathCallback) {
    this.suddenDeathCallbacks.add(cb);
    return () => this.suddenDeathCallbacks.delete(cb);
  }

  public onOpponentQuit(cb: OpponentQuitCallback) {
    this.quitCallbacks.add(cb);
    return () => this.quitCallbacks.delete(cb);
  }

  public onLatency(cb: LatencyCallback) {
    this.latencyCallbacks.add(cb);
    return () => this.latencyCallbacks.delete(cb);
  }

  private notifyRoom() {
    if (this.currentRoom) {
      const roomCopy = { ...this.currentRoom };
      this.roomCallbacks.forEach((cb) => cb(roomCopy));
      // Save local room state
      localStorage.setItem(`room_${this.currentRoom.roomCode}`, JSON.stringify(this.currentRoom));
    }
  }

  /**
   * Create a new match room
   */
  public async createRoom(host: UserProfile, mode: GameMode): Promise<RoomState> {
    this.cleanup();
    this.currentUserId = host.id;
    const roomCode = this.generateRoomCode();

    const hostPlayer: PlayerState = {
      userId: host.id,
      username: host.username,
      allTimeHighScore: host.allTimeHighScore,
      highestTileAchieved: host.highestTileAchieved,
      score: '0',
      highestTile: '2',
      isLocked: false,
    };

    const newRoom: RoomState = {
      id: `room-${Date.now()}`,
      roomCode,
      mode,
      status: 'waiting',
      hostId: host.id,
      player1: hostPlayer,
      blitzDurationSeconds: mode === 'blitz_3m' ? 180 : mode === 'blitz_5m' ? 300 : undefined,
      blitzTimeRemaining: mode === 'blitz_3m' ? 180 : mode === 'blitz_5m' ? 300 : undefined,
    };

    this.currentRoom = newRoom;
    localStorage.setItem(`room_${roomCode}`, JSON.stringify(newRoom));

    this.setupChannels(roomCode);
    this.notifyRoom();
    return newRoom;
  }

  /**
   * Join an existing room
   */
  public async joinRoom(roomCode: string, guest: UserProfile): Promise<RoomState> {
    this.cleanup();
    const cleanCode = roomCode.trim().toUpperCase().replace('#', '');
    this.currentUserId = guest.id;

    // Check existing room state in storage
    const raw = localStorage.getItem(`room_${cleanCode}`);
    if (!raw) {
      throw new Error(`Room #${cleanCode} not found.`);
    }

    const room: RoomState = JSON.parse(raw);
    if (room.status !== 'waiting') {
      throw new Error(`Room #${cleanCode} has already started or ended.`);
    }

    if (room.player1.userId === guest.id) {
      // Re-joining as host
      this.currentRoom = room;
      this.setupChannels(cleanCode);
      this.notifyRoom();
      return room;
    }

    const guestPlayer: PlayerState = {
      userId: guest.id,
      username: guest.username,
      allTimeHighScore: guest.allTimeHighScore,
      highestTileAchieved: guest.highestTileAchieved,
      score: '0',
      highestTile: '2',
      isLocked: false,
    };

    room.player2 = guestPlayer;
    room.status = 'active';
    room.startedAt = Date.now();
    this.currentRoom = room;
    localStorage.setItem(`room_${cleanCode}`, JSON.stringify(room));

    this.setupChannels(cleanCode);

    // Notify host that player 2 joined and match starts
    this.broadcastMessage({
      type: 'join_room',
      roomCode: cleanCode,
      player: guestPlayer,
    });

    this.notifyRoom();
    this.startTimers();
    return room;
  }

  /**
   * Set up dual transport: Supabase Realtime Channel + BroadcastChannel
   */
  private setupChannels(roomCode: string) {
    // 1. Local BroadcastChannel for seamless zero-config local testing
    try {
      this.broadcastChannel = new BroadcastChannel(`duel_${roomCode}`);
      this.broadcastChannel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    // 2. Supabase Realtime Broadcast channel if configured
    if (isSupabaseConfigured && supabase) {
      this.supabaseChannel = supabase.channel(`room_${roomCode}`, {
        config: { broadcast: { self: false } },
      });

      this.supabaseChannel
        .on('broadcast', { event: 'game_event' }, (payload: { payload: RealtimeMessage }) => {
          this.handleMessage(payload.payload);
        })
        .subscribe((status: string) => {
          console.log('Supabase channel status:', status);
        });
    }

    // Periodic ping for latency measurement
    this.pingInterval = setInterval(() => {
      this.broadcastMessage({ type: 'ping', timestamp: performance.now() });
    }, 4000);
  }

  /**
   * Broadcast message to peer
   */
  private broadcastMessage(msg: RealtimeMessage) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {}
    }
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'game_event',
          payload: msg,
        });
      } catch {}
    }
  }

  /**
   * Process incoming realtime events
   */
  private handleMessage(msg: RealtimeMessage) {
    if (!this.currentRoom) return;

    switch (msg.type) {
      case 'join_room': {
        if (msg.player.userId !== this.currentUserId) {
          this.currentRoom.player2 = msg.player;
          this.currentRoom.status = 'active';
          this.currentRoom.startedAt = Date.now();
          this.notifyRoom();
          this.startTimers();
        }
        break;
      }

      case 'score_update': {
        const { payload } = msg;
        if (payload.userId !== this.currentUserId) {
          if (this.currentRoom.player1.userId === payload.userId) {
            this.currentRoom.player1.score = payload.score;
            this.currentRoom.player1.highestTile = payload.highestTile;
            this.currentRoom.player1.isLocked = payload.isLocked;
          } else if (this.currentRoom.player2?.userId === payload.userId) {
            this.currentRoom.player2.score = payload.score;
            this.currentRoom.player2.highestTile = payload.highestTile;
            this.currentRoom.player2.isLocked = payload.isLocked;
          }
          this.notifyRoom();
          this.scoreCallbacks.forEach((cb) => cb(payload));

          // In Sudden Death, check if the surviving player beat the locked player's score
          if (this.currentRoom.mode === 'sudden_death' && this.currentRoom.suddenDeathGraceActive) {
            this.checkSuddenDeathVictory();
          }
        }
        break;
      }

      case 'sudden_death_start': {
        if (!this.currentRoom.suddenDeathGraceActive) {
          this.currentRoom.suddenDeathGraceActive = true;
          this.currentRoom.suddenDeathLockedUserId = msg.lockedUserId;
          this.currentRoom.suddenDeathGraceRemaining = 60;
          this.notifyRoom();
          this.suddenDeathCallbacks.forEach((cb) => cb(msg.lockedUserId, msg.targetScore));
          this.startSuddenDeathTimer();
        }
        break;
      }

      case 'player_locked': {
        if (msg.userId !== this.currentUserId) {
          if (this.currentRoom.player1.userId === msg.userId) {
            this.currentRoom.player1.isLocked = true;
            this.currentRoom.player1.score = msg.finalScore;
            this.currentRoom.player1.highestTile = msg.finalHighestTile;
          } else if (this.currentRoom.player2?.userId === msg.userId) {
            this.currentRoom.player2.isLocked = true;
            this.currentRoom.player2.score = msg.finalScore;
            this.currentRoom.player2.highestTile = msg.finalHighestTile;
          }
          this.notifyRoom();

          // If Sudden Death mode and the other player locks first, trigger sudden death countdown
          if (this.currentRoom.mode === 'sudden_death') {
            if (!this.currentRoom.suddenDeathGraceActive) {
              this.currentRoom.suddenDeathGraceActive = true;
              this.currentRoom.suddenDeathLockedUserId = msg.userId;
              this.currentRoom.suddenDeathGraceRemaining = 60;
              this.notifyRoom();
              this.suddenDeathCallbacks.forEach((cb) => cb(msg.userId, msg.finalScore));
              this.startSuddenDeathTimer();
            } else {
              // Both locked! Evaluate winner
              this.evaluateSuddenDeathWinner('Both players locked out.');
            }
          }
        }
        break;
      }

      case 'match_finished': {
        this.currentRoom.status = 'completed';
        this.currentRoom.winnerId = msg.winnerId;
        this.notifyRoom();
        this.finishCallbacks.forEach((cb) => cb(msg.winnerId, msg.reason));
        break;
      }

      case 'player_quit': {
        if (msg.userId !== this.currentUserId) {
          this.currentRoom.status = 'completed';
          this.currentRoom.winnerId = this.currentUserId;
          this.notifyRoom();
          this.quitCallbacks.forEach((cb) => cb());
          this.finishCallbacks.forEach((cb) => cb(this.currentUserId, 'Opponent abandoned the match.'));
        }
        break;
      }

      case 'ping': {
        this.broadcastMessage({ type: 'pong', timestamp: msg.timestamp });
        break;
      }

      case 'pong': {
        const latency = Math.round(performance.now() - msg.timestamp);
        this.latencyCallbacks.forEach((cb) => cb(latency));
        break;
      }
    }
  }

  /**
   * Broadcast score update on every merge swipe (< 150ms requirement)
   */
  public sendScoreUpdate(score: string, highestTile: string, isLocked: boolean) {
    if (!this.currentRoom) return;

    // Update local state
    if (this.currentRoom.player1.userId === this.currentUserId) {
      this.currentRoom.player1.score = score;
      this.currentRoom.player1.highestTile = highestTile;
      this.currentRoom.player1.isLocked = isLocked;
    } else if (this.currentRoom.player2?.userId === this.currentUserId) {
      this.currentRoom.player2.score = score;
      this.currentRoom.player2.highestTile = highestTile;
      this.currentRoom.player2.isLocked = isLocked;
    }

    const payload: ScoreUpdatePayload = {
      event: 'score_update',
      userId: this.currentUserId,
      score,
      highestTile,
      isLocked,
    };

    this.broadcastMessage({
      type: 'score_update',
      roomCode: this.currentRoom.roomCode,
      payload,
    });

    this.notifyRoom();

    if (this.currentRoom.mode === 'sudden_death' && this.currentRoom.suddenDeathGraceActive) {
      this.checkSuddenDeathVictory();
    }
  }

  /**
   * Handle board lockout for current user
   */
  public sendPlayerLocked(finalScore: string, finalHighestTile: string) {
    if (!this.currentRoom) return;

    if (this.currentRoom.player1.userId === this.currentUserId) {
      this.currentRoom.player1.isLocked = true;
      this.currentRoom.player1.score = finalScore;
      this.currentRoom.player1.highestTile = finalHighestTile;
    } else if (this.currentRoom.player2?.userId === this.currentUserId) {
      this.currentRoom.player2.isLocked = true;
      this.currentRoom.player2.score = finalScore;
      this.currentRoom.player2.highestTile = finalHighestTile;
    }

    this.broadcastMessage({
      type: 'player_locked',
      roomCode: this.currentRoom.roomCode,
      userId: this.currentUserId,
      finalScore,
      finalHighestTile,
    });

    this.notifyRoom();

    if (this.currentRoom.mode === 'sudden_death') {
      if (!this.currentRoom.suddenDeathGraceActive) {
        // Current user locked first! Start sudden death grace period for opponent
        this.currentRoom.suddenDeathGraceActive = true;
        this.currentRoom.suddenDeathLockedUserId = this.currentUserId;
        this.currentRoom.suddenDeathGraceRemaining = 60;
        this.notifyRoom();

        this.broadcastMessage({
          type: 'sudden_death_start',
          roomCode: this.currentRoom.roomCode,
          lockedUserId: this.currentUserId,
          targetScore: finalScore,
        });

        this.startSuddenDeathTimer();
      } else {
        // Both locked
        this.evaluateSuddenDeathWinner('Both players locked out.');
      }
    }
  }

  /**
   * Check sudden death victory condition:
   * If Player A locked out and Player B surpasses Player A's score during the 60s window
   */
  private checkSuddenDeathVictory() {
    if (!this.currentRoom || !this.currentRoom.player2) return;

    const p1Score = BigInt(this.currentRoom.player1.score || '0');
    const p2Score = BigInt(this.currentRoom.player2.score || '0');
    const lockedUserId = this.currentRoom.suddenDeathLockedUserId;

    if (lockedUserId === this.currentRoom.player1.userId) {
      // Player 1 locked first. Does player 2 beat them?
      if (p2Score > p1Score) {
        this.finishMatch(this.currentRoom.player2.userId, `${this.currentRoom.player2.username} surpassed the locked target score!`);
      }
    } else if (lockedUserId === this.currentRoom.player2.userId) {
      // Player 2 locked first. Does player 1 beat them?
      if (p1Score > p2Score) {
        this.finishMatch(this.currentRoom.player1.userId, `${this.currentRoom.player1.username} surpassed the locked target score!`);
      }
    }
  }

  /**
   * Start 60-second grace countdown for Sudden Death
   */
  private startSuddenDeathTimer() {
    if (this.suddenDeathInterval) clearInterval(this.suddenDeathInterval);

    this.suddenDeathInterval = setInterval(() => {
      if (!this.currentRoom || !this.currentRoom.suddenDeathGraceActive) {
        clearInterval(this.suddenDeathInterval);
        return;
      }

      if (typeof this.currentRoom.suddenDeathGraceRemaining === 'number') {
        this.currentRoom.suddenDeathGraceRemaining--;
        this.notifyRoom();

        if (this.currentRoom.suddenDeathGraceRemaining <= 0) {
          clearInterval(this.suddenDeathInterval);
          this.evaluateSuddenDeathWinner('Grace countdown expired!');
        }
      }
    }, 1000);
  }

  /**
   * Evaluate winner of sudden death match
   */
  private evaluateSuddenDeathWinner(reason: string) {
    if (!this.currentRoom || !this.currentRoom.player2) return;

    const p1Score = BigInt(this.currentRoom.player1.score || '0');
    const p2Score = BigInt(this.currentRoom.player2.score || '0');

    let winnerId: string | null = null;
    let fullReason = reason;

    if (p1Score > p2Score) {
      winnerId = this.currentRoom.player1.userId;
      fullReason = `${this.currentRoom.player1.username} wins with higher score (${p1Score.toLocaleString()} vs ${p2Score.toLocaleString()})!`;
    } else if (p2Score > p1Score) {
      winnerId = this.currentRoom.player2.userId;
      fullReason = `${this.currentRoom.player2.username} wins with higher score (${p2Score.toLocaleString()} vs ${p1Score.toLocaleString()})!`;
    } else {
      winnerId = null;
      fullReason = `Dead heat tie (${p1Score.toLocaleString()})!`;
    }

    this.finishMatch(winnerId, fullReason);
  }

  /**
   * Start match timers (Blitz mode countdown)
   */
  private startTimers() {
    if (!this.currentRoom) return;

    if (this.currentRoom.mode.startsWith('blitz')) {
      const initialSeconds = this.currentRoom.mode === 'blitz_3m' ? 180 : 300;
      this.currentRoom.blitzTimeRemaining = initialSeconds;

      if (this.blitzInterval) clearInterval(this.blitzInterval);

      this.blitzInterval = setInterval(() => {
        if (!this.currentRoom || this.currentRoom.status !== 'active') {
          clearInterval(this.blitzInterval);
          return;
        }

        if (typeof this.currentRoom.blitzTimeRemaining === 'number') {
          this.currentRoom.blitzTimeRemaining--;
          this.notifyRoom();

          if (this.currentRoom.blitzTimeRemaining <= 0) {
            clearInterval(this.blitzInterval);
            this.evaluateBlitzWinner();
          }
        }
      }, 1000);
    }
  }

  /**
   * Evaluate Blitz winner on timer expiration
   */
  private evaluateBlitzWinner() {
    if (!this.currentRoom || !this.currentRoom.player2) return;

    const p1Score = BigInt(this.currentRoom.player1.score || '0');
    const p2Score = BigInt(this.currentRoom.player2.score || '0');

    let winnerId: string | null = null;
    let reason = 'Time expired! ';

    if (p1Score > p2Score) {
      winnerId = this.currentRoom.player1.userId;
      reason += `${this.currentRoom.player1.username} wins with ${p1Score.toLocaleString()}!`;
    } else if (p2Score > p1Score) {
      winnerId = this.currentRoom.player2.userId;
      reason += `${this.currentRoom.player2.username} wins with ${p2Score.toLocaleString()}!`;
    } else {
      winnerId = null;
      reason += `Tied score of ${p1Score.toLocaleString()}!`;
    }

    this.finishMatch(winnerId, reason);
  }

  /**
   * Finish match and record scores
   */
  public finishMatch(winnerId: string | null, reason: string) {
    if (!this.currentRoom || this.currentRoom.status === 'completed') return;

    this.currentRoom.status = 'completed';
    this.currentRoom.winnerId = winnerId;
    this.notifyRoom();

    this.broadcastMessage({
      type: 'match_finished',
      roomCode: this.currentRoom.roomCode,
      winnerId,
      reason,
    });

    this.finishCallbacks.forEach((cb) => cb(winnerId, reason));

    // Submit scores to Hall of Fame
    if (this.currentRoom.player1) {
      leaderboard.submitScore(
        this.currentRoom.player1.userId,
        this.currentRoom.player1.username,
        this.currentRoom.player1.score,
        this.currentRoom.player1.highestTile
      );
    }
    if (this.currentRoom.player2) {
      leaderboard.submitScore(
        this.currentRoom.player2.userId,
        this.currentRoom.player2.username,
        this.currentRoom.player2.score,
        this.currentRoom.player2.highestTile
      );
    }

    this.cleanupTimers();
  }

  /**
   * Abandon match (hardware Back button or Quit button)
   */
  public abandonMatch() {
    if (!this.currentRoom) return;

    this.broadcastMessage({
      type: 'player_quit',
      roomCode: this.currentRoom.roomCode,
      userId: this.currentUserId,
    });

    const otherPlayerId =
      this.currentRoom.player1.userId === this.currentUserId
        ? this.currentRoom.player2?.userId || null
        : this.currentRoom.player1.userId;

    this.currentRoom.status = 'completed';
    this.currentRoom.winnerId = otherPlayerId;
    this.notifyRoom();
    this.finishCallbacks.forEach((cb) => cb(otherPlayerId, 'Match abandoned.'));

    this.cleanup();
  }

  public leaveRoom() {
    this.cleanup();
    this.currentRoom = null;
  }

  private cleanupTimers() {
    if (this.blitzInterval) clearInterval(this.blitzInterval);
    if (this.suddenDeathInterval) clearInterval(this.suddenDeathInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  private cleanup() {
    this.cleanupTimers();
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel.unsubscribe();
      } catch {}
      this.supabaseChannel = null;
    }
  }
}

export const multiplayer = new MultiplayerService();

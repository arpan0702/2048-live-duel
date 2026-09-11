import { useState, useEffect, useCallback } from 'react';
import type { Direction, GameMode, Grid, PlayerState, RoomState, UserProfile } from './types/game';
import {
  initializeBoard,
  moveGrid,
  getHighestTileOnBoard,
  serializeGrid,
  deserializeGrid,
} from './engine/gameEngine';
import { identity, generateUUID } from './services/identity';
import { multiplayer } from './services/multiplayer';
import { leaderboard } from './services/leaderboard';
import { sound } from './services/sound';
import { nativeBridge } from './services/nativeBridge';
import { HUD } from './components/HUD';
import { GameBoard } from './components/GameBoard';
import { Lobby } from './components/Lobby';
import { MatchResultModal } from './components/MatchResultModal';
import { AbandonModal } from './components/AbandonModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { AuthModal } from './components/AuthModal';

export default function App() {
  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // View & Game State
  const [view, setView] = useState<'lobby' | 'game'>('lobby');
  const [gameMode, setGameMode] = useState<GameMode>('classic_duel');
  const [grid, setGrid] = useState<Grid>(() => initializeBoard());
  const [currentScore, setCurrentScore] = useState<bigint>(0n);
  const [currentHighestTile, setCurrentHighestTile] = useState<bigint>(2n);
  const [isLocked, setIsLocked] = useState(false);
  const [isSpectatingOpponent, setIsSpectatingOpponent] = useState(false);

  // Multiplayer State
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [waitingRoom, setWaitingRoom] = useState<RoomState | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Sound State
  const [isMuted, setIsMuted] = useState(sound.getIsMuted());

  // Modal States
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'signup' }>({
    isOpen: false,
    mode: 'login',
  });
  const [isAbandonModalOpen, setIsAbandonModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    isOpen: boolean;
    winnerId: string | null;
    reason: string;
  }>({
    isOpen: false,
    winnerId: null,
    reason: '',
  });

  // Start fresh game board
  const resetGame = useCallback(() => {
    const freshGrid = initializeBoard();
    const highest = getHighestTileOnBoard(freshGrid);
    setGrid(freshGrid);
    setCurrentScore(0n);
    setCurrentHighestTile(highest);
    setIsLocked(false);
    setIsSpectatingOpponent(false);
  }, []);

  // Start multiplayer match
  const startMultiplayerMatch = useCallback(
    (room: RoomState) => {
      const freshGrid = initializeBoard();
      const highest = getHighestTileOnBoard(freshGrid);
      setGrid(freshGrid);
      setCurrentScore(0n);
      setCurrentHighestTile(highest);
      setIsLocked(false);
      setIsSpectatingOpponent(false);
      setCurrentRoom(room);
      setGameMode(room.mode);
      setView('game');
      setMatchResult({ isOpen: false, winnerId: null, reason: '' });

      // Broadcast initial starting grid to opponent
      multiplayer.sendScoreUpdate('0', highest.toString(), false, serializeGrid(freshGrid));
    },
    []
  );

  // Load identity from cached session and handle URL join params
  useEffect(() => {
    async function init() {
      const profile = await identity.loadCachedSession();

      // Check if URL has ?join=XXXXXX
      const urlParams = new URLSearchParams(window.location.search);
      const joinCode = urlParams.get('join');

      if (profile) {
        setUserProfile(profile);

        // Auto-join room if requested in URL
        if (joinCode) {
          try {
            const room = await multiplayer.joinRoom(joinCode, profile);
            startMultiplayerMatch(room);
            // Clean up url
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (err: any) {
            console.warn('Auto-join failed:', err.message);
          }
        }
      } else {
        // If there's an invite link but user has no cached session, open auth modal
        if (joinCode) {
          setAuthModal({ isOpen: true, mode: 'signup' });
        }
      }
    }

    init();
  }, [startMultiplayerMatch]);

  // Register Android Hardware Back Button and 24-Hour Background Grace Timeout
  useEffect(() => {
    const unregisterBack = nativeBridge.registerBackButton(() => {
      if (view === 'game') {
        setIsAbandonModalOpen(true);
      }
    });

    nativeBridge.setBackgroundGraceTimeout(() => {
      if (view === 'game' && currentRoom && currentRoom.status === 'active') {
        multiplayer.abandonMatch();
      }
    });

    return () => {
      unregisterBack();
    };
  }, [view, currentRoom]);

  // Subscribe to multiplayer events
  useEffect(() => {
    const unsubRoom = multiplayer.onRoomUpdated((room) => {
      setCurrentRoom({ ...room });

      // Host was waiting, and player 2 just joined! Transition host to game
      if (waitingRoom && room.status === 'active') {
        setWaitingRoom(null);
        startMultiplayerMatch(room);
      }
    });

    const unsubScore = multiplayer.onOpponentScore(() => {
      // Trigger re-render of opponent score via room state
      if (currentRoom) {
        setCurrentRoom({ ...currentRoom });
      }
    });

    const unsubFinish = multiplayer.onMatchFinished((winnerId, reason) => {
      setMatchResult({
        isOpen: true,
        winnerId,
        reason,
      });
      setIsSpectatingOpponent(false);
    });

    const unsubSuddenDeath = multiplayer.onSuddenDeath(() => {
      sound.playLock();
    });

    const unsubLatency = multiplayer.onLatency((ms) => {
      setLatencyMs(ms);
    });

    return () => {
      unsubRoom();
      unsubScore();
      unsubFinish();
      unsubSuddenDeath();
      unsubLatency();
    };
  }, [waitingRoom, currentRoom]);

  // Start solo practice
  const handleStartSolo = () => {
    resetGame();
    setCurrentRoom(null);
    setGameMode('solo_endless');
    setView('game');
    setMatchResult({ isOpen: false, winnerId: null, reason: '' });
  };

  // Create room handler
  const handleCreateRoom = async (mode: GameMode): Promise<RoomState> => {
    if (!userProfile) {
      setAuthModal({ isOpen: true, mode: 'signup' });
      throw new Error('Please log in or sign up first.');
    }
    const room = await multiplayer.createRoom(userProfile, mode);
    setWaitingRoom(room);
    return room;
  };

  // Join room handler
  const handleJoinRoom = async (code: string): Promise<RoomState> => {
    if (!userProfile) {
      setAuthModal({ isOpen: true, mode: 'signup' });
      throw new Error('Please log in or sign up first.');
    }
    const room = await multiplayer.joinRoom(code, userProfile);
    startMultiplayerMatch(room);
    return room;
  };

  // Auth handlers
  const handleLogout = async () => {
    await identity.logout();
    setUserProfile(null);
  };

  const handleAuthSuccess = async (profile: UserProfile) => {
    setUserProfile(profile);
    setAuthModal({ isOpen: false, mode: 'login' });

    // Check if URL has ?join=XXXXXX
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    if (joinCode) {
      try {
        const room = await multiplayer.joinRoom(joinCode, profile);
        startMultiplayerMatch(room);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err: any) {
        console.warn('Post-auth join failed:', err.message);
      }
    }
  };

  // Grid Move Handler (Keyboard or Touch Swipe)
  const handleMove = useCallback(
    (direction: Direction) => {
      if (isLocked || matchResult.isOpen) return;

      const result = moveGrid(grid, direction);
      if (!result.moved) return;

      const newScore = currentScore + result.scoreGained;
      const newHighest = result.highestTile > currentHighestTile ? result.highestTile : currentHighestTile;

      setGrid(result.grid);
      setCurrentScore(newScore);
      setCurrentHighestTile(newHighest);

      // Sound effect
      if (result.mergedCount > 0) {
        sound.playMerge(newHighest);
      } else {
        sound.playSlide();
      }

      // Update personal records
      if (userProfile) {
        identity.updatePersonalRecords(newScore.toString(), newHighest.toString()).then((updated) => {
          if (updated) setUserProfile(updated);
        });
      }

      // Multiplayer synchronization
      const serialized = serializeGrid(result.grid);
      if (currentRoom && currentRoom.status === 'active') {
        multiplayer.sendScoreUpdate(newScore.toString(), newHighest.toString(), result.isLocked, serialized);
      }

      // Board lockout handling
      if (result.isLocked) {
        setIsLocked(true);
        sound.playLock();

        if (currentRoom && currentRoom.status === 'active') {
          multiplayer.sendPlayerLocked(newScore.toString(), newHighest.toString(), serialized);
          // Enable spectator live-view of opponent if opponent is still playing
          setIsSpectatingOpponent(true);
        } else {
          // Solo mode game over
          leaderboard.submitScore(
            userProfile?.id || generateUUID(),
            userProfile?.username || 'SoloPlayer',
            newScore.toString(),
            newHighest.toString()
          );
          setMatchResult({
            isOpen: true,
            winnerId: null,
            reason: 'Board has no valid moves remaining.',
          });
        }
      }
    },
    [grid, isLocked, matchResult.isOpen, currentScore, currentHighestTile, currentRoom, userProfile]
  );

  // Quit / Abandon Match
  const handleAbandonConfirm = () => {
    setIsAbandonModalOpen(false);
    setIsSpectatingOpponent(false);
    if (currentRoom) {
      multiplayer.abandonMatch();
    }
    setView('lobby');
    setWaitingRoom(null);
  };

  // Rematch / Play Again
  const handlePlayAgain = () => {
    setMatchResult({ isOpen: false, winnerId: null, reason: '' });
    setIsSpectatingOpponent(false);
    resetGame();
    if (currentRoom) {
      // Re-create a new room with same mode
      if (userProfile) {
        multiplayer.createRoom(userProfile, gameMode).then((newRoom) => {
          setWaitingRoom(newRoom);
          setView('lobby');
        });
      }
    } else {
      setView('game');
    }
  };

  const handleReturnLobby = () => {
    setMatchResult({ isOpen: false, winnerId: null, reason: '' });
    setIsSpectatingOpponent(false);
    if (currentRoom) {
      multiplayer.leaveRoom();
    }
    setCurrentRoom(null);
    setWaitingRoom(null);
    setView('lobby');
  };

  // Derive current player & opponent states
  const myUserId = userProfile?.id || '';
  let userPlayerState: PlayerState = {
    userId: myUserId,
    username: userProfile?.username || 'You',
    allTimeHighScore: userProfile?.allTimeHighScore || '0',
    highestTileAchieved: userProfile?.highestTileAchieved || '2',
    score: currentScore.toString(),
    highestTile: currentHighestTile.toString(),
    isLocked,
    grid: serializeGrid(grid),
  };

  let opponentPlayerState: PlayerState | undefined = undefined;
  if (currentRoom) {
    if (currentRoom.player1.userId === myUserId) {
      opponentPlayerState = currentRoom.player2;
    } else {
      opponentPlayerState = currentRoom.player1;
    }
  }

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col justify-between py-2 sm:py-6 px-2 select-none font-sans">
      {/* App Header Bar */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-black text-stone-950 font-mono shadow-md">
            2K
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight text-white flex items-center gap-1.5">
              <span>2048 Live Duel</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Endless 4×4
              </span>
            </h1>
          </div>
        </div>

        {view === 'lobby' && (
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="p-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-400 text-amber-400 transition-colors cursor-pointer"
            title="Hall of Fame Leaderboard"
          >
            🏆
          </button>
        )}
      </header>

      {/* Main View: Lobby or Game */}
      <main className="w-full flex-1 flex flex-col justify-center items-center">
        {view === 'lobby' ? (
          <Lobby
            userProfile={userProfile}
            onOpenAuth={(mode) => setAuthModal({ isOpen: true, mode: mode || 'login' })}
            onLogout={handleLogout}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartSolo={handleStartSolo}
            onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
            waitingRoom={waitingRoom}
            onCancelWaiting={() => setWaitingRoom(null)}
          />
        ) : (
          <div className="w-full flex flex-col items-center gap-3">
            <HUD
              room={currentRoom}
              mode={gameMode}
              userPlayer={userPlayerState}
              opponentPlayer={opponentPlayerState}
              latencyMs={latencyMs}
              onQuitClick={() => setIsAbandonModalOpen(true)}
              isMuted={isMuted}
              onToggleMute={() => {
                const nextMuted = sound.toggleMute();
                setIsMuted(nextMuted);
              }}
              isSpectatingOpponent={isSpectatingOpponent}
              onToggleSpectate={() => setIsSpectatingOpponent((prev) => !prev)}
            />

            <GameBoard
              grid={
                isSpectatingOpponent && opponentPlayerState?.grid
                  ? deserializeGrid(opponentPlayerState.grid)
                  : grid
              }
              onMove={handleMove}
              disabled={isLocked || matchResult.isOpen || isSpectatingOpponent}
              isSpectating={isSpectatingOpponent}
              spectatingUsername={opponentPlayerState?.username}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-2 text-[11px] text-stone-600 font-mono">
        Classic 4×4 • Endless High Limits • P2P Realtime
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={authModal.isOpen}
        initialMode={authModal.mode}
        onClose={() => setAuthModal({ ...authModal, isOpen: false })}
        onSuccess={handleAuthSuccess}
      />

      <AbandonModal
        isOpen={isAbandonModalOpen}
        onConfirm={handleAbandonConfirm}
        onCancel={() => setIsAbandonModalOpen(false)}
      />

      <MatchResultModal
        isOpen={matchResult.isOpen}
        winnerId={matchResult.winnerId}
        currentUserId={myUserId}
        reason={matchResult.reason}
        userPlayer={userPlayerState}
        opponentPlayer={opponentPlayerState}
        isSolo={gameMode === 'solo_endless'}
        onPlayAgain={handlePlayAgain}
        onReturnLobby={handleReturnLobby}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentUsername={userProfile?.username || ''}
      />
    </div>
  );
}

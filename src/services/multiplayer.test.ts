import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { multiplayer } from './multiplayer';
import type { UserProfile } from '../types/game';

// In-memory mock for localStorage and BroadcastChannel in Node environment
const store: Record<string, string> = {};

beforeAll(() => {
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] || null,
    length: 0,
  };

  // Mock BroadcastChannel
  (globalThis as any).BroadcastChannel = class {
    name: string;
    onmessage: any = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(_data: any) {}
    close() {}
  };
});

describe('Multiplayer Engine & Duel Logic', () => {
  const hostProfile: UserProfile = {
    id: 'user-host-1',
    username: 'MatrixMaster',
    allTimeHighScore: '210540',
    highestTileAchieved: '8192',
  };

  const guestProfile: UserProfile = {
    id: 'user-guest-2',
    username: 'SpeedDemon',
    allTimeHighScore: '184200',
    highestTileAchieved: '4096',
  };

  beforeEach(() => {
    localStorage.clear();
    multiplayer.leaveRoom();
  });

  it('generates a clean 6-character room code', () => {
    const code = multiplayer.generateRoomCode();
    expect(code).toHaveLength(6);
    expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
  });

  it('creates room and transitions status on guest join', async () => {
    const room = await multiplayer.createRoom(hostProfile, 'sudden_death');
    expect(room.status).toBe('waiting');
    expect(room.player1.username).toBe('MatrixMaster');

    const joinedRoom = await multiplayer.joinRoom(room.roomCode, guestProfile);
    expect(joinedRoom.status).toBe('active');
    expect(joinedRoom.player2?.username).toBe('SpeedDemon');
  });

  it('handles score update broadcasting between players', async () => {
    const room = await multiplayer.createRoom(hostProfile, 'sudden_death');
    await multiplayer.joinRoom(room.roomCode, guestProfile);

    multiplayer.sendScoreUpdate('14920', '1024', false);
    const updatedRoom = multiplayer.getCurrentRoom();
    expect(updatedRoom?.player2?.score).toBe('14920');
    expect(updatedRoom?.player2?.highestTile).toBe('1024');
  });

  it('triggers sudden death grace countdown when a player locks out', async () => {
    const room = await multiplayer.createRoom(hostProfile, 'sudden_death');
    await multiplayer.joinRoom(room.roomCode, guestProfile);

    multiplayer.sendPlayerLocked('12000', '1024');

    const current = multiplayer.getCurrentRoom();
    expect(current?.suddenDeathGraceActive).toBe(true);
    expect(current?.suddenDeathLockedUserId).toBe(guestProfile.id);
    expect(current?.suddenDeathGraceRemaining).toBe(60);
  });

  it('in Classic Duel, game does NOT end when first player locks out, allowing other player to continue', async () => {
    const room = await multiplayer.createRoom(hostProfile, 'classic_duel');
    await multiplayer.joinRoom(room.roomCode, guestProfile);

    // Guest locks out first
    multiplayer.sendPlayerLocked('15000', '1024');

    const current = multiplayer.getCurrentRoom();
    // Match should still be active for the surviving player!
    expect(current?.status).toBe('active');
    expect(current?.player2?.isLocked).toBe(true);
    expect(current?.player1.isLocked).toBe(false);

    // Guest updates score (or surviving player keeps playing)
    multiplayer.sendScoreUpdate('18000', '2048', false);
    const afterPlay = multiplayer.getCurrentRoom();
    expect(afterPlay?.status).toBe('active');
    expect(afterPlay?.player2?.score).toBe('18000');
  });

  it('in Classic Duel, finishes match and declares winner when both players lock out', async () => {
    const room = await multiplayer.createRoom(hostProfile, 'classic_duel');
    await multiplayer.joinRoom(room.roomCode, guestProfile);

    let finished = false;
    let winner: string | null = null;
    multiplayer.onMatchFinished((w) => {
      finished = true;
      winner = w;
    });

    // Mark host (player 1) as already locked out with 25000
    const current = multiplayer.getCurrentRoom()!;
    current.player1.isLocked = true;
    current.player1.score = '25000';

    // Now guest (player 2) locks out with 18000
    multiplayer.sendPlayerLocked('18000', '1024');

    expect(finished).toBe(true);
    expect(winner).toBe(hostProfile.id); // Host has 25000 vs Guest 18000
    const finalRoom = multiplayer.getCurrentRoom();
    expect(finalRoom?.status).toBe('completed');
  });
});

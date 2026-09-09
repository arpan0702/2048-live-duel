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
});

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { identity } from './identity';

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
});

describe('IdentityService & Session Management', () => {
  beforeEach(async () => {
    localStorage.clear();
    await identity.logout();
  });

  it('signs up a new user and caches session for auto-login', async () => {
    const res = await identity.signUp('NeoUser', 'secretPass123');
    expect(res.success).toBe(true);
    expect(res.profile?.username).toBe('NeoUser');
    expect(res.profile?.allTimeHighScore).toBe('0');
    expect(res.profile?.highestTileAchieved).toBe('2');

    // Verify auto-login restores profile from cache
    const cached = await identity.loadCachedSession();
    expect(cached).not.toBeNull();
    expect(cached?.username).toBe('NeoUser');
    expect(cached?.id).toBe(res.profile?.id);
  });

  it('rejects duplicate username signups', async () => {
    await identity.signUp('DuplicateUser', 'pass1');
    const duplicate = await identity.signUp('duplicateuser', 'pass2');
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain('already taken');
  });

  it('verifies password on login', async () => {
    await identity.signUp('Gamer101', 'myPassword');
    await identity.logout();

    // Wrong password
    const fail = await identity.login('Gamer101', 'wrongPassword');
    expect(fail.success).toBe(false);
    expect(fail.error).toContain('Incorrect password');

    // Correct password
    const success = await identity.login('Gamer101', 'myPassword');
    expect(success.success).toBe(true);
    expect(success.profile?.username).toBe('Gamer101');
  });

  it('updates personal records and caches them', async () => {
    await identity.signUp('HighScorer', 'pass123');
    const updated = await identity.updatePersonalRecords('48200', '2048');

    expect(updated?.allTimeHighScore).toBe('48200');
    expect(updated?.highestTileAchieved).toBe('2048');

    // Verify persisted in cached session
    const cached = await identity.loadCachedSession();
    expect(cached?.allTimeHighScore).toBe('48200');
    expect(cached?.highestTileAchieved).toBe('2048');
  });

  it('clears cached session on logout', async () => {
    await identity.signUp('LogoutTest', 'pass123');
    expect(await identity.loadCachedSession()).not.toBeNull();

    await identity.logout();
    expect(await identity.loadCachedSession()).toBeNull();
  });
});

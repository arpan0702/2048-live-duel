import { Preferences } from '@capacitor/preferences';
import type { UserProfile } from '../types/game';
import { supabase, isSupabaseConfigured } from './supabase';
import { leaderboard } from './leaderboard';

const STORAGE_KEYS = {
  ACTIVE_SESSION: 'user_active_session',
  REGISTERED_ACCOUNTS: 'registered_user_accounts',
};

// Generate UUID v4
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface StoredAccount {
  id: string;
  username: string;
  password: string;
  allTimeHighScore: string;
  highestTileAchieved: string;
  createdAt: string;
}

class IdentityService {
  private currentProfile: UserProfile | null = null;

  private async getStorageItem(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) return value;
    } catch {}
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }

  private async setStorageItem(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch {}
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  private async removeStorageItem(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch {}
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }

  private getLocalAccounts(): Record<string, StoredAccount> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REGISTERED_ACCOUNTS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveLocalAccounts(accounts: Record<string, StoredAccount>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(accounts));
    } catch {}
  }

  /**
   * Auto-login user from cached session data in storage
   */
  public async loadCachedSession(): Promise<UserProfile | null> {
    const rawSession = await this.getStorageItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (!rawSession) return null;

    try {
      const cached = JSON.parse(rawSession);
      if (!cached || !cached.username) return null;

      // Try fetching latest scores from Supabase if available
      let allTimeHighScore = cached.allTimeHighScore || '0';
      let highestTileAchieved = cached.highestTileAchieved || '2';

      if (isSupabaseConfigured && supabase && cached.id) {
        try {
          const { data } = await supabase
            .from('users')
            .select('all_time_high_score, highest_tile_achieved')
            .eq('id', cached.id)
            .single();
          if (data) {
            const dbHigh = (data.all_time_high_score ?? '0').toString();
            const dbTile = (data.highest_tile_achieved ?? '2').toString();
            if (BigInt(dbHigh) > BigInt(allTimeHighScore)) allTimeHighScore = dbHigh;
            if (BigInt(dbTile) > BigInt(highestTileAchieved)) highestTileAchieved = dbTile;
          }
        } catch {}
      }

      this.currentProfile = {
        id: cached.id,
        username: cached.username,
        password: cached.password,
        allTimeHighScore,
        highestTileAchieved,
      };

      // Refresh cache with latest values
      await this.setStorageItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.currentProfile));
      return this.currentProfile;
    } catch {
      return null;
    }
  }

  public getProfile(): UserProfile | null {
    return this.currentProfile;
  }

  /**
   * Sign up a new user account with username and password
   */
  public async signUp(
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters.' };
    }
    if (cleanUsername.length > 16) {
      return { success: false, error: 'Username cannot exceed 16 characters.' };
    }
    if (!cleanPassword || cleanPassword.length < 3) {
      return { success: false, error: 'Password must be at least 3 characters.' };
    }

    const key = cleanUsername.toLowerCase();
    const accounts = this.getLocalAccounts();

    // Check local accounts registry
    if (accounts[key]) {
      return { success: false, error: `Username "${cleanUsername}" is already taken. Please Log In.` };
    }

    // Check Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('users')
          .select('id')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (data) {
          return { success: false, error: `Username "${cleanUsername}" is already taken. Please Log In.` };
        }
      } catch {}
    }

    const id = generateUUID();
    const newAccount: StoredAccount = {
      id,
      username: cleanUsername,
      password: cleanPassword,
      allTimeHighScore: '0',
      highestTileAchieved: '2',
      createdAt: new Date().toISOString(),
    };

    // Save locally
    accounts[key] = newAccount;
    this.saveLocalAccounts(accounts);

    // Save to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('users').insert({
          id,
          username: cleanUsername,
          password: cleanPassword,
          all_time_high_score: 0,
          highest_tile_achieved: 2,
        });
      } catch (err) {
        console.warn('Supabase signUp insert fallback:', err);
      }
    }

    this.currentProfile = {
      id,
      username: cleanUsername,
      password: cleanPassword,
      allTimeHighScore: '0',
      highestTileAchieved: '2',
    };

    // Cache active session for auto-login
    await this.setStorageItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.currentProfile));

    // Register initial record in Hall of Fame
    leaderboard.submitScore(id, cleanUsername, '0', '2');

    return { success: true, profile: this.currentProfile };
  }

  /**
   * Log in existing user with username and password
   */
  public async login(
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      return { success: false, error: 'Please enter both username and password.' };
    }

    const key = cleanUsername.toLowerCase();
    const accounts = this.getLocalAccounts();
    let account = accounts[key];

    // Check Supabase if not found locally
    if (!account && isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('users')
          .select('id, username, password, all_time_high_score, highest_tile_achieved')
          .ilike('username', cleanUsername)
          .maybeSingle();

        if (data) {
          account = {
            id: data.id,
            username: data.username,
            password: data.password || cleanPassword,
            allTimeHighScore: (data.all_time_high_score ?? '0').toString(),
            highestTileAchieved: (data.highest_tile_achieved ?? '2').toString(),
            createdAt: new Date().toISOString(),
          };
          accounts[key] = account;
          this.saveLocalAccounts(accounts);
        }
      } catch {}
    }

    if (!account) {
      return {
        success: false,
        error: `Account "${cleanUsername}" not found. Please Sign Up first.`,
      };
    }

    // Verify password
    if (account.password && account.password !== cleanPassword) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    this.currentProfile = {
      id: account.id,
      username: account.username,
      password: account.password,
      allTimeHighScore: account.allTimeHighScore,
      highestTileAchieved: account.highestTileAchieved,
    };

    // Cache active session for auto-login
    await this.setStorageItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.currentProfile));
    return { success: true, profile: this.currentProfile };
  }

  /**
   * Log out and clear cached session
   */
  public async logout(): Promise<void> {
    this.currentProfile = null;
    await this.removeStorageItem(STORAGE_KEYS.ACTIVE_SESSION);
  }

  /**
   * Update personal high score & highest tile
   */
  public async updatePersonalRecords(score: string, tile: string): Promise<UserProfile | null> {
    if (!this.currentProfile) return null;

    let updated = false;
    const currentHigh = BigInt(this.currentProfile.allTimeHighScore || '0');
    const newScore = BigInt(score || '0');
    if (newScore > currentHigh) {
      this.currentProfile.allTimeHighScore = newScore.toString();
      updated = true;
    }

    const currentTile = BigInt(this.currentProfile.highestTileAchieved || '2');
    const newTile = BigInt(tile || '2');
    if (newTile > currentTile) {
      this.currentProfile.highestTileAchieved = newTile.toString();
      updated = true;
    }

    if (updated) {
      // Update local accounts registry
      const accounts = this.getLocalAccounts();
      const key = this.currentProfile.username.toLowerCase();
      if (accounts[key]) {
        accounts[key].allTimeHighScore = this.currentProfile.allTimeHighScore;
        accounts[key].highestTileAchieved = this.currentProfile.highestTileAchieved;
        this.saveLocalAccounts(accounts);
      }

      // Update active session cache
      await this.setStorageItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(this.currentProfile));

      // Sync to Leaderboard
      leaderboard.submitScore(
        this.currentProfile.id,
        this.currentProfile.username,
        this.currentProfile.allTimeHighScore,
        this.currentProfile.highestTileAchieved
      );
    }

    return updated ? { ...this.currentProfile } : this.currentProfile;
  }
}

export const identity = new IdentityService();

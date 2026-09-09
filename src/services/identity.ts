import { Preferences } from '@capacitor/preferences';
import type { UserProfile } from '../types/game';

const STORAGE_KEYS = {
  USER_ID: 'user_session_uuid',
  USERNAME: 'user_chosen_name',
  HIGH_SCORE: 'user_high_score',
  HIGHEST_TILE: 'user_highest_tile',
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

class IdentityService {
  private currentProfile: UserProfile | null = null;

  private async getStorageItem(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) return value;
    } catch {
      // Fall back to localStorage
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }

  private async setStorageItem(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch {
      // Fall back
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  /**
   * Load existing profile from storage
   */
  public async loadProfile(): Promise<UserProfile | null> {
    const id = await this.getStorageItem(STORAGE_KEYS.USER_ID);
    const username = await this.getStorageItem(STORAGE_KEYS.USERNAME);
    const allTimeHighScore = (await this.getStorageItem(STORAGE_KEYS.HIGH_SCORE)) || '0';
    const highestTileAchieved = (await this.getStorageItem(STORAGE_KEYS.HIGHEST_TILE)) || '2';

    if (id && username) {
      this.currentProfile = {
        id,
        username,
        allTimeHighScore,
        highestTileAchieved,
      };
      return this.currentProfile;
    }
    return null;
  }

  public getProfile(): UserProfile | null {
    return this.currentProfile;
  }

  /**
   * Check if username is already registered to a different device
   * (In local mock mode, uses registered_users registry in localStorage)
   */
  public async validateAndSetUsername(username: string): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters.' };
    }
    if (cleanUsername.length > 16) {
      return { success: false, error: 'Username cannot exceed 16 characters.' };
    }

    let id = await this.getStorageItem(STORAGE_KEYS.USER_ID);
    if (!id) {
      id = generateUUID();
      await this.setStorageItem(STORAGE_KEYS.USER_ID, id);
    }

    // Check registry for conflict
    const registryRaw = localStorage.getItem('known_registered_users') || '{}';
    let registry: Record<string, { id: string; username: string }> = {};
    try {
      registry = JSON.parse(registryRaw);
    } catch {
      registry = {};
    }

    const existingUserId = registry[cleanUsername.toLowerCase()]?.id;
    if (existingUserId && existingUserId !== id) {
      return {
        success: false,
        error: `Username "${cleanUsername}" is already taken by another player. Please choose another.`,
      };
    }

    // Save registration
    registry[cleanUsername.toLowerCase()] = { id, username: cleanUsername };
    localStorage.setItem('known_registered_users', JSON.stringify(registry));

    const allTimeHighScore = (await this.getStorageItem(STORAGE_KEYS.HIGH_SCORE)) || '0';
    const highestTileAchieved = (await this.getStorageItem(STORAGE_KEYS.HIGHEST_TILE)) || '2';

    await this.setStorageItem(STORAGE_KEYS.USERNAME, cleanUsername);

    this.currentProfile = {
      id,
      username: cleanUsername,
      allTimeHighScore,
      highestTileAchieved,
    };

    return { success: true, profile: this.currentProfile };
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
      await this.setStorageItem(STORAGE_KEYS.HIGH_SCORE, this.currentProfile.allTimeHighScore);
      updated = true;
    }

    const currentTile = BigInt(this.currentProfile.highestTileAchieved || '2');
    const newTile = BigInt(tile || '2');
    if (newTile > currentTile) {
      this.currentProfile.highestTileAchieved = newTile.toString();
      await this.setStorageItem(STORAGE_KEYS.HIGHEST_TILE, this.currentProfile.highestTileAchieved);
      updated = true;
    }

    return updated ? { ...this.currentProfile } : this.currentProfile;
  }
}

export const identity = new IdentityService();

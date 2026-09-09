import type { LeaderboardUser } from '../types/game';

const INITIAL_SEED_LEADERBOARD: LeaderboardUser[] = [
  {
    id: 'seed-1',
    username: 'MatrixMaster',
    all_time_high_score: '210540',
    highest_tile_achieved: '8192',
  },
  {
    id: 'seed-2',
    username: 'SpeedDemon',
    all_time_high_score: '184200',
    highest_tile_achieved: '4096',
  },
  {
    id: 'seed-3',
    username: 'TileCrusher',
    all_time_high_score: '142380',
    highest_tile_achieved: '4096',
  },
  {
    id: 'seed-4',
    username: 'EndlessGrid',
    all_time_high_score: '115600',
    highest_tile_achieved: '4096',
  },
  {
    id: 'seed-5',
    username: 'Neo2048',
    all_time_high_score: '98400',
    highest_tile_achieved: '2048',
  },
  {
    id: 'seed-6',
    username: 'GridNinja',
    all_time_high_score: '74200',
    highest_tile_achieved: '2048',
  },
  {
    id: 'seed-7',
    username: 'ApexSlider',
    all_time_high_score: '58120',
    highest_tile_achieved: '2048',
  },
];

const LEADERBOARD_STORAGE_KEY = 'hall_of_fame_scores';

class LeaderboardService {
  private getLocalScores(): LeaderboardUser[] {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(INITIAL_SEED_LEADERBOARD));
      return INITIAL_SEED_LEADERBOARD;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_SEED_LEADERBOARD;
    }
  }

  public async getTopLeaderboard(): Promise<LeaderboardUser[]> {
    const scores = this.getLocalScores();
    return scores.sort((a, b) => {
      const aScore = BigInt(a.all_time_high_score || '0');
      const bScore = BigInt(b.all_time_high_score || '0');
      if (bScore > aScore) return 1;
      if (bScore < aScore) return -1;
      return 0;
    });
  }

  public async submitScore(
    userId: string,
    username: string,
    score: string,
    highestTile: string
  ): Promise<void> {
    const scores = this.getLocalScores();
    const existingIndex = scores.findIndex((u) => u.id === userId || u.username.toLowerCase() === username.toLowerCase());

    const newScoreBig = BigInt(score || '0');
    const newTileBig = BigInt(highestTile || '2');

    if (existingIndex >= 0) {
      const existing = scores[existingIndex];
      const curScore = BigInt(existing.all_time_high_score || '0');
      const curTile = BigInt(existing.highest_tile_achieved || '2');

      scores[existingIndex] = {
        ...existing,
        username,
        all_time_high_score: (newScoreBig > curScore ? newScoreBig : curScore).toString(),
        highest_tile_achieved: (newTileBig > curTile ? newTileBig : curTile).toString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      scores.push({
        id: userId,
        username,
        all_time_high_score: score,
        highest_tile_achieved: highestTile,
        updated_at: new Date().toISOString(),
      });
    }

    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(scores));
  }
}

export const leaderboard = new LeaderboardService();

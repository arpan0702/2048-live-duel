export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface TileData {
  id: string;
  value: bigint;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
}

export type Grid = (TileData | null)[][];

export type GameMode = 'sudden_death' | 'blitz_3m' | 'blitz_5m' | 'solo_endless';

export interface UserProfile {
  id: string; // UUID
  username: string;
  allTimeHighScore: string; // Stored as string for BigInt/numeric serialization
  highestTileAchieved: string;
}

export type RoomStatus = 'waiting' | 'active' | 'completed' | 'abandoned';

export interface PlayerState {
  userId: string;
  username: string;
  allTimeHighScore: string;
  highestTileAchieved: string;
  score: string; // BigInt string
  highestTile: string; // BigInt string
  isLocked: boolean;
  graceTimeRemaining?: number; // For sudden death 60s countdown
}

export interface RoomState {
  id: string;
  roomCode: string;
  mode: GameMode;
  status: RoomStatus;
  hostId: string;
  player1: PlayerState;
  player2?: PlayerState;
  winnerId?: string | null;
  startedAt?: number;
  blitzDurationSeconds?: number;
  blitzTimeRemaining?: number;
  suddenDeathGraceActive?: boolean;
  suddenDeathLockedUserId?: string | null;
  suddenDeathGraceRemaining?: number; // 60s
}

export interface ScoreUpdatePayload {
  event: 'score_update';
  userId: string;
  score: string;
  highestTile: string;
  isLocked: boolean;
}

export type RealtimeMessage =
  | { type: 'join_room'; roomCode: string; player: PlayerState }
  | { type: 'player_ready'; roomCode: string; userId: string }
  | { type: 'start_match'; roomCode: string; mode: GameMode; startTime: number }
  | { type: 'score_update'; roomCode: string; payload: ScoreUpdatePayload }
  | { type: 'player_locked'; roomCode: string; userId: string; finalScore: string; finalHighestTile: string }
  | { type: 'sudden_death_start'; roomCode: string; lockedUserId: string; targetScore: string }
  | { type: 'match_finished'; roomCode: string; winnerId: string | null; reason: string }
  | { type: 'player_quit'; roomCode: string; userId: string }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number };

export interface LeaderboardUser {
  id: string;
  username: string;
  all_time_high_score: string;
  highest_tile_achieved: string;
  updated_at?: string;
}

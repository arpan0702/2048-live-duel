import React from 'react';
import { Volume2, VolumeX, LogOut, Radio, Clock, AlertTriangle, Eye } from 'lucide-react';
import { formatScore, formatTileValue, getTileVisual } from '../engine/gameEngine';
import type { GameMode, PlayerState, RoomState } from '../types/game';

interface HUDProps {
  room: RoomState | null;
  mode: GameMode;
  userPlayer: PlayerState;
  opponentPlayer?: PlayerState;
  latencyMs: number | null;
  onQuitClick: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isSpectatingOpponent?: boolean;
  onToggleSpectate?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  room,
  mode,
  userPlayer,
  opponentPlayer,
  latencyMs,
  onQuitClick,
  isMuted,
  onToggleMute,
  isSpectatingOpponent = false,
  onToggleSpectate,
}) => {
  const isSolo = mode === 'solo_endless' || !opponentPlayer;

  // Calculate score difference
  let leadText = '';
  let leadClass = '';
  if (!isSolo && opponentPlayer) {
    const userScore = BigInt(userPlayer.score || '0');
    const oppScore = BigInt(opponentPlayer.score || '0');
    if (userScore > oppScore) {
      const diff = userScore - oppScore;
      leadText = `(+${formatScore(diff)} Lead)`;
      leadClass = 'text-emerald-400 font-bold';
    } else if (oppScore > userScore) {
      const diff = oppScore - userScore;
      leadText = `(-${formatScore(diff)} Behind)`;
      leadClass = 'text-rose-400 font-bold';
    } else {
      leadText = '(Tied)';
      leadClass = 'text-stone-400 font-semibold';
    }
  }

  // Format Blitz timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const opponentTileBig = BigInt(opponentPlayer?.highestTile || '2');
  const userTileBig = BigInt(userPlayer.highestTile || '2');

  const oppTileVisual = getTileVisual(opponentTileBig);
  const userTileVisual = getTileVisual(userTileBig);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-2.5 px-2 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-stone-900/90 border border-stone-800 rounded-xl px-3.5 py-2.5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-mono font-bold tracking-wider text-sm sm:text-base text-stone-200">
            {room ? `ROOM: #${room.roomCode}` : 'SOLO PRACTICE'}
          </span>
          {latencyMs !== null && (
            <span className="hidden xs:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
              <Radio className="w-3 h-3" />
              {latencyMs}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-stone-300" />}
          </button>

          <button
            onClick={onQuitClick}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Quit</span>
          </button>
        </div>
      </div>

      {/* Match Banners: Blitz Timer or Sudden Death Grace Period */}
      {room?.mode.startsWith('blitz') && typeof room.blitzTimeRemaining === 'number' && (
        <div
          className={`flex items-center justify-center gap-2 py-1 px-3 rounded-lg border text-xs font-mono font-bold ${
            room.blitzTimeRemaining <= 30
              ? 'bg-rose-950/80 border-rose-600 text-rose-200 animate-pulse'
              : 'bg-amber-950/50 border-amber-700/60 text-amber-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>BLITZ TIME REMAINING: {formatTime(room.blitzTimeRemaining)}</span>
        </div>
      )}

      {room?.suddenDeathGraceActive && typeof room.suddenDeathGraceRemaining === 'number' && (
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-red-950/90 border border-red-500 text-red-100 text-xs font-mono font-black animate-pulse shadow-red-900/50 shadow-lg">
          <AlertTriangle className="w-4 h-4 text-amber-300" />
          <span>
            SUDDEN DEATH: {room.suddenDeathGraceRemaining}s GRACE WINDOW (
            {room.suddenDeathLockedUserId === userPlayer.userId ? 'Your board locked!' : 'Opponent locked out!'})
          </span>
        </div>
      )}

      {/* Spectator / Live View Banner when User is Locked Out but Opponent is still playing */}
      {userPlayer.isLocked && opponentPlayer && !opponentPlayer.isLocked && (
        <div className="bg-stone-900/95 border-2 border-rose-500/70 rounded-xl p-2.5 shadow-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold text-white truncate">
                Your board locked! {opponentPlayer.username} is still playing
              </div>
              <div className="text-[10px] text-stone-400 font-mono truncate">
                {isSpectatingOpponent ? 'Currently watching opponent live' : 'Viewing your final locked board'}
              </div>
            </div>
          </div>

          {onToggleSpectate && (
            <button
              type="button"
              onClick={onToggleSpectate}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-md ${
                isSpectatingOpponent
                  ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isSpectatingOpponent ? 'My Board' : 'Live View Opponent'}</span>
            </button>
          )}
        </div>
      )}

      {/* Opponent Locked Notice when User is still playing */}
      {!userPlayer.isLocked && opponentPlayer && opponentPlayer.isLocked && (
        <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-xl p-2.5 shadow-lg flex items-center gap-2 text-xs text-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="font-semibold">
            Opponent {opponentPlayer.username} locked out at {formatScore(opponentPlayer.score)}! Keep pushing to maximize your score!
          </span>
        </div>
      )}

      {/* Opponent HUD Card */}
      {!isSolo && opponentPlayer && (
        <div className="bg-stone-900/80 border border-stone-800/90 rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-rose-300 uppercase tracking-wide text-[10px] bg-rose-950/80 border border-rose-800/60 px-1.5 py-0.5 rounded">
                Opponent
              </span>
              <span className="font-bold text-stone-200 truncate">{opponentPlayer.username}</span>
              <span className="text-[11px] text-stone-400">
                (Best: {formatScore(opponentPlayer.allTimeHighScore)})
              </span>
            </div>
            {opponentPlayer.isLocked && (
              <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded uppercase">
                Locked
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-stone-400">Live Score:</span>
              <span className="text-lg sm:text-xl font-mono font-black text-amber-300">
                {formatScore(opponentPlayer.score)}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-stone-400 text-[11px]">Tile:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded ${oppTileVisual.bg} ${oppTileVisual.text} shadow-sm text-xs`}
              >
                {formatTileValue(opponentTileBig)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* You HUD Card */}
      <div className="bg-stone-900/95 border-2 border-amber-500/50 rounded-xl p-3 shadow-md">
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-amber-300 uppercase tracking-wide text-[10px] bg-amber-950/80 border border-amber-700/60 px-1.5 py-0.5 rounded">
              You
            </span>
            <span className="font-bold text-stone-100 truncate">{userPlayer.username}</span>
            <span className="text-[11px] text-stone-400">
              (Best: {formatScore(userPlayer.allTimeHighScore)})
            </span>
          </div>
          {userPlayer.isLocked && (
            <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded uppercase animate-bounce">
              Board Locked
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-stone-400">Live Score:</span>
            <span className="text-xl sm:text-2xl font-mono font-black text-white">
              {formatScore(userPlayer.score)}
            </span>
            {leadText && <span className={`text-xs ${leadClass}`}>{leadText}</span>}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-stone-400 text-[11px]">Tile:</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded ${userTileVisual.bg} ${userTileVisual.text} shadow-sm text-xs`}
            >
              {formatTileValue(userTileBig)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

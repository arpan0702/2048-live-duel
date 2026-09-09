import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Frown, Award, ArrowRight, RotateCcw } from 'lucide-react';
import { formatScore, formatTileValue, getTileVisual } from '../engine/gameEngine';
import { sound } from '../services/sound';
import type { PlayerState } from '../types/game';

interface MatchResultModalProps {
  isOpen: boolean;
  winnerId: string | null;
  currentUserId: string;
  reason: string;
  userPlayer: PlayerState;
  opponentPlayer?: PlayerState;
  isSolo: boolean;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  isOpen,
  winnerId,
  currentUserId,
  reason,
  userPlayer,
  opponentPlayer,
  isSolo,
  onPlayAgain,
  onReturnLobby,
}) => {
  const isWinner = !isSolo && winnerId === currentUserId;
  const isLoser = !isSolo && winnerId !== null && winnerId !== currentUserId;
  const isTie = !isSolo && winnerId === null;

  useEffect(() => {
    if (!isOpen) return;

    if (isWinner || (isSolo && BigInt(userPlayer.score || '0') > 2000n)) {
      sound.playVictory();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
      });
    } else if (isLoser) {
      sound.playDefeat();
    }
  }, [isOpen, isWinner, isLoser, isSolo, userPlayer.score]);

  if (!isOpen) return null;

  const userTileBig = BigInt(userPlayer.highestTile || '2');
  const userTileVisual = getTileVisual(userTileBig);

  const oppTileBig = opponentPlayer ? BigInt(opponentPlayer.highestTile || '2') : 2n;
  const oppTileVisual = getTileVisual(oppTileBig);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-stone-900 border-2 border-stone-800 rounded-3xl p-6 shadow-2xl text-center">
        {/* Victory / Defeat Badge */}
        <div className="mb-4">
          {isWinner ? (
            <div className="inline-flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 mb-2 shadow-lg shadow-amber-500/20">
                <Trophy className="w-9 h-9" />
              </div>
              <h2 className="text-3xl font-black text-amber-400 tracking-wide uppercase">VICTORY!</h2>
              <p className="text-sm text-stone-300 mt-1 font-medium">{reason}</p>
            </div>
          ) : isLoser ? (
            <div className="inline-flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 mb-2">
                <Frown className="w-9 h-9" />
              </div>
              <h2 className="text-3xl font-black text-rose-400 tracking-wide uppercase">DEFEAT</h2>
              <p className="text-sm text-stone-300 mt-1 font-medium">{reason}</p>
            </div>
          ) : isTie ? (
            <div className="inline-flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 mb-2">
                <Award className="w-9 h-9" />
              </div>
              <h2 className="text-3xl font-black text-stone-200 tracking-wide uppercase">MATCH TIED</h2>
              <p className="text-sm text-stone-400 mt-1 font-medium">{reason}</p>
            </div>
          ) : (
            <div className="inline-flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 mb-2">
                <Award className="w-9 h-9" />
              </div>
              <h2 className="text-3xl font-black text-cyan-300 tracking-wide uppercase">GAME OVER</h2>
              <p className="text-sm text-stone-400 mt-1 font-medium">Board Locked! Great run.</p>
            </div>
          )}
        </div>

        {/* Comparison Stats Table */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 my-5">
          <div className="grid grid-cols-2 gap-4 divide-x divide-stone-800">
            {/* Player Stats */}
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                {userPlayer.username} (You)
              </span>
              <span className="text-2xl font-mono font-black text-white mt-1">
                {formatScore(userPlayer.score)}
              </span>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[11px] text-stone-500">Max Tile:</span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${userTileVisual.bg} ${userTileVisual.text}`}
                >
                  {formatTileValue(userTileBig)}
                </span>
              </div>
            </div>

            {/* Opponent Stats */}
            {!isSolo && opponentPlayer ? (
              <div className="flex flex-col items-center">
                <span className="text-xs uppercase font-bold text-stone-400 tracking-wider">
                  {opponentPlayer.username}
                </span>
                <span className="text-2xl font-mono font-black text-stone-300 mt-1">
                  {formatScore(opponentPlayer.score)}
                </span>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-500">Max Tile:</span>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${oppTileVisual.bg} ${oppTileVisual.text}`}
                  >
                    {formatTileValue(oppTileBig)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-stone-500 text-xs">
                <span>Personal Best</span>
                <span className="text-lg font-mono font-bold text-stone-300 mt-1">
                  {formatScore(userPlayer.allTimeHighScore)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
          <button
            onClick={onReturnLobby}
            className="flex-1 py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Return to Lobby</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

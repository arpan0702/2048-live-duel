import React, { useEffect, useState } from 'react';
import { Trophy, X, Medal, Flame } from 'lucide-react';
import type { LeaderboardUser } from '../types/game';
import { leaderboard } from '../services/leaderboard';
import { formatScore, formatTileValue, getTileVisual } from '../engine/gameEngine';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUsername,
}) => {
  const [scores, setScores] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    leaderboard.getTopLeaderboard().then((data) => {
      setScores(data);
      setLoading(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-stone-100 uppercase tracking-wide flex items-center gap-2">
                Hall of Fame
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              </h3>
              <p className="text-xs text-stone-400">Global All-Time High Scores & Max Tiles</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Leaderboard Table / List */}
        <div className="flex-1 overflow-y-auto my-4 space-y-2 pr-1">
          {loading ? (
            <div className="py-12 text-center text-stone-500 font-mono text-sm">
              Loading rankings...
            </div>
          ) : scores.length === 0 ? (
            <div className="py-12 text-center text-stone-500 font-mono text-sm">
              No scores recorded yet. Be the first!
            </div>
          ) : (
            scores.map((user, idx) => {
              const rank = idx + 1;
              const isCurrentUser = user.username.toLowerCase() === currentUsername.toLowerCase();
              const tileBig = BigInt(user.highest_tile_achieved || '2');
              const tileVisual = getTileVisual(tileBig);

              let rankBadge = (
                <span className="w-7 h-7 rounded-lg bg-stone-800 text-stone-400 font-mono font-bold text-xs flex items-center justify-center">
                  #{rank}
                </span>
              );

              if (rank === 1) {
                rankBadge = (
                  <span className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Medal className="w-4 h-4" />
                  </span>
                );
              } else if (rank === 2) {
                rankBadge = (
                  <span className="w-7 h-7 rounded-lg bg-slate-300 text-stone-950 font-bold text-xs flex items-center justify-center">
                    <Medal className="w-4 h-4" />
                  </span>
                );
              } else if (rank === 3) {
                rankBadge = (
                  <span className="w-7 h-7 rounded-lg bg-amber-700 text-amber-100 font-bold text-xs flex items-center justify-center">
                    <Medal className="w-4 h-4" />
                  </span>
                );
              }

              return (
                <div
                  key={`${user.id}-${idx}`}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isCurrentUser
                      ? 'bg-amber-950/30 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                      : 'bg-stone-950/60 border-stone-800/80 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {rankBadge}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-100 truncate">
                          {user.username}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-amber-500 text-stone-950 font-black px-1.5 py-0.2 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono">
                        High Score: <span className="text-amber-400 font-bold">{formatScore(user.all_time_high_score)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-stone-500 uppercase font-mono">Max Tile</span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded shadow-sm ${tileVisual.bg} ${tileVisual.text}`}
                    >
                      {formatTileValue(tileBig)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-sm transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};

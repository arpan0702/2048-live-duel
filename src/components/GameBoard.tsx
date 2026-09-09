import React, { useEffect, useRef } from 'react';
import type { Direction, Grid } from '../types/game';
import { formatTileValue, getTileVisual, GRID_SIZE } from '../engine/gameEngine';

interface GameBoardProps {
  grid: Grid;
  onMove: (direction: Direction) => void;
  disabled?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({ grid, onMove, disabled = false }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStartCoords = useRef<{ x: number; y: number } | null>(null);

  // Keyboard controls: WASD & Arrow Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      let direction: Direction | null = null;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          direction = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          direction = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          direction = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          direction = 'RIGHT';
          break;
      }

      if (direction) {
        e.preventDefault();
        onMove(direction);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onMove, disabled]);

  // Touch Swipe gestures with touch-action: none
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || e.touches.length === 0) return;
    touchStartCoords.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled || !touchStartCoords.current || e.changedTouches.length === 0) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartCoords.current.x;
    const deltaY = endY - touchStartCoords.current.y;
    touchStartCoords.current = null;

    const minSwipeDistance = 30; // Minimum distance threshold in px
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < minSwipeDistance) {
      return; // Too short to qualify as a deliberate swipe
    }

    if (absX > absY) {
      // Horizontal swipe
      onMove(deltaX > 0 ? 'RIGHT' : 'LEFT');
    } else {
      // Vertical swipe
      onMove(deltaY > 0 ? 'DOWN' : 'UP');
    }
  };

  // Extract all non-null tiles for rendering
  const activeTiles = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = grid[r][c];
      if (tile) {
        activeTiles.push(tile);
      }
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-2 flex flex-col items-center">
      {/* Board Outer Container with touch-action: none to block browser scroll & pull-to-refresh */}
      <div
        ref={boardRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
        className="relative w-full aspect-square bg-stone-900 border-4 border-stone-800 rounded-2xl p-2 sm:p-3.5 shadow-2xl overflow-hidden select-none"
      >
        {/* 4x4 Grid Background Cells */}
        <div className="w-full h-full grid grid-cols-4 grid-rows-4 gap-2 sm:gap-3">
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={`cell-${idx}`}
              className="w-full h-full rounded-xl bg-stone-800/60 border border-stone-700/40"
            />
          ))}
        </div>

        {/* Dynamic Tiles Layer */}
        <div className="absolute inset-2 sm:inset-3.5 pointer-events-none">
          {activeTiles.map((tile) => {
            const visual = getTileVisual(tile.value);
            const formatted = formatTileValue(tile.value);

            // Calculate grid position percentage
            const topPct = (tile.row * 25);
            const leftPct = (tile.col * 25);

            return (
              <div
                key={tile.id}
                style={{
                  top: `${topPct}%`,
                  left: `${leftPct}%`,
                  width: '25%',
                  height: '25%',
                }}
                className={`absolute p-1 sm:p-1.5 transition-all duration-100 ease-out`}
              >
                <div
                  className={`w-full h-full rounded-xl flex items-center justify-center font-mono shadow-md ${visual.bg} ${visual.text} ${visual.glow || ''} ${
                    tile.isNew ? 'animate-spawn' : tile.isMerged ? 'animate-pop' : ''
                  }`}
                >
                  <span className={`${visual.fontSize} drop-shadow-sm leading-none`}>
                    {formatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disabled / Locked Overlay */}
        {disabled && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
            <span className="text-white font-mono font-bold text-lg bg-stone-900/90 border border-stone-700 px-4 py-2 rounded-xl shadow-xl">
              Board Inactive
            </span>
          </div>
        )}
      </div>

      {/* Touch / Keyboard hints */}
      <div className="mt-2 text-stone-500 text-[11px] font-mono text-center flex items-center justify-center gap-3">
        <span>Touch: Swipe In Any Direction</span>
        <span>•</span>
        <span>Keyboard: WASD / Arrow Keys</span>
      </div>
    </div>
  );
};

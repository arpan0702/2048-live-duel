import type { Direction, Grid, TileData } from '../types/game';

export const GRID_SIZE = 4;

let nextTileId = 1;
export function generateTileId(): string {
  return `tile-${Date.now()}-${nextTileId++}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Format tile value according to PRD:
 * - <= 8192: standard integer display
 * - >= 16384: compact display (e.g. 16K, 32K, 64K, 128K)
 */
export function formatTileValue(value: bigint): string {
  if (value <= 8192n) {
    return value.toString();
  }
  if (value >= 1048576n) {
    const mVal = Number(value) / 1048576;
    return `${Number.isInteger(mVal) ? mVal : mVal.toFixed(1)}M`;
  }
  const kVal = Number(value) / 1024;
  return `${Number.isInteger(kVal) ? kVal : kVal.toFixed(1)}K`;
}

/**
 * Compare two string-encoded BigInts
 */
export function compareBigInt(aStr: string, bStr: string): number {
  try {
    const a = BigInt(aStr || '0');
    const b = BigInt(bStr || '0');
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Format score with commas for readability (e.g., 184,200)
 */
export function formatScore(scoreStr: string | bigint): string {
  try {
    const big = typeof scoreStr === 'bigint' ? scoreStr : BigInt(scoreStr || '0');
    return big.toLocaleString();
  } catch {
    return scoreStr.toString();
  }
}

/**
 * Create an empty 4x4 grid
 */
export function createEmptyGrid(): Grid {
  const grid: Grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      grid[r][c] = null;
    }
  }
  return grid;
}

/**
 * Find all empty cell coordinates in the grid
 */
export function getEmptyCells(grid: Grid): { row: number; col: number }[] {
  const empty: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === null) {
        empty.push({ row: r, col: c });
      }
    }
  }
  return empty;
}

/**
 * Spawn a new tile in a random empty cell (90% chance of 2, 10% chance of 4)
 */
export function spawnRandomTile(grid: Grid): { grid: Grid; newTile: TileData | null } {
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) {
    return { grid, newTile: null };
  }

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = Math.random() < 0.9 ? 2n : 4n;

  const newTile: TileData = {
    id: generateTileId(),
    value,
    row: randomCell.row,
    col: randomCell.col,
    isNew: true,
  };

  const newGrid = cloneGrid(grid);
  newGrid[randomCell.row][randomCell.col] = newTile;
  return { grid: newGrid, newTile };
}

/**
 * Deep clone grid
 */
export function cloneGrid(grid: Grid): Grid {
  return grid.map(row => row.map(tile => (tile ? { ...tile, isNew: false, isMerged: false } : null)));
}

/**
 * Check if the board is locked:
 * - Match ends ONLY when a player's board locks (no vacant cells and zero valid horizontal/vertical merges remaining)
 */
export function isBoardLocked(grid: Grid): boolean {
  // Check for any empty cells
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === null) {
        return false;
      }
    }
  }

  // Check for any valid horizontal merges
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      const current = grid[r][c];
      const next = grid[r][c + 1];
      if (current && next && current.value === next.value) {
        return false;
      }
    }
  }

  // Check for any valid vertical merges
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r < GRID_SIZE - 1; r++) {
      const current = grid[r][c];
      const next = grid[r + 1][c];
      if (current && next && current.value === next.value) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get the highest tile value currently on the board
 */
export function getHighestTileOnBoard(grid: Grid): bigint {
  let highest = 0n;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = grid[r][c];
      if (tile && tile.value > highest) {
        highest = tile.value;
      }
    }
  }
  return highest;
}

export interface MoveResult {
  grid: Grid;
  moved: boolean;
  scoreGained: bigint;
  mergedCount: number;
  highestTile: bigint;
  isLocked: boolean;
}

/**
 * Execute a slide and merge move in the given direction
 */
export function moveGrid(currentGrid: Grid, direction: Direction): MoveResult {
  let scoreGained = 0n;
  let moved = false;
  let mergedCount = 0;

  // Clone grid to work on
  const grid = cloneGrid(currentGrid);

  // Helper to process a single line (row or column)
  function processLine(line: (TileData | null)[]): (TileData | null)[] {
    // 1. Filter non-null tiles
    const nonNullTiles = line.filter((t): t is TileData => t !== null);
    const result: (TileData | null)[] = [];

    let i = 0;
    while (i < nonNullTiles.length) {
      const current = nonNullTiles[i];
      if (i + 1 < nonNullTiles.length && current.value === nonNullTiles[i + 1].value) {
        // Merge tiles
        const mergedValue = current.value * 2n;
        scoreGained += mergedValue;
        mergedCount++;

        result.push({
          id: generateTileId(),
          value: mergedValue,
          row: 0,
          col: 0,
          isMerged: true,
        });
        i += 2;
      } else {
        result.push({
          ...current,
          isNew: false,
          isMerged: false,
        });
        i++;
      }
    }

    // Pad with nulls up to GRID_SIZE
    while (result.length < GRID_SIZE) {
      result.push(null);
    }

    return result;
  }

  if (direction === 'LEFT') {
    for (let r = 0; r < GRID_SIZE; r++) {
      const line = grid[r];
      const processed = processLine(line);
      for (let c = 0; c < GRID_SIZE; c++) {
        const originalTile = grid[r][c];
        const newTile = processed[c];
        if (newTile) {
          newTile.row = r;
          newTile.col = c;
        }
        if (
          (!originalTile && newTile) ||
          (originalTile && !newTile) ||
          (originalTile && newTile && originalTile.value !== newTile.value) ||
          (originalTile && newTile && (originalTile.row !== newTile.row || originalTile.col !== newTile.col))
        ) {
          moved = true;
        }
        grid[r][c] = newTile;
      }
    }
  } else if (direction === 'RIGHT') {
    for (let r = 0; r < GRID_SIZE; r++) {
      const line = [...grid[r]].reverse();
      const processed = processLine(line);
      processed.reverse();
      for (let c = 0; c < GRID_SIZE; c++) {
        const originalTile = grid[r][c];
        const newTile = processed[c];
        if (newTile) {
          newTile.row = r;
          newTile.col = c;
        }
        if (
          (!originalTile && newTile) ||
          (originalTile && !newTile) ||
          (originalTile && newTile && originalTile.value !== newTile.value) ||
          (originalTile && newTile && (originalTile.row !== newTile.row || originalTile.col !== newTile.col))
        ) {
          moved = true;
        }
        grid[r][c] = newTile;
      }
    }
  } else if (direction === 'UP') {
    for (let c = 0; c < GRID_SIZE; c++) {
      const line: (TileData | null)[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        line.push(grid[r][c]);
      }
      const processed = processLine(line);
      for (let r = 0; r < GRID_SIZE; r++) {
        const originalTile = grid[r][c];
        const newTile = processed[r];
        if (newTile) {
          newTile.row = r;
          newTile.col = c;
        }
        if (
          (!originalTile && newTile) ||
          (originalTile && !newTile) ||
          (originalTile && newTile && originalTile.value !== newTile.value) ||
          (originalTile && newTile && (originalTile.row !== newTile.row || originalTile.col !== newTile.col))
        ) {
          moved = true;
        }
        grid[r][c] = newTile;
      }
    }
  } else if (direction === 'DOWN') {
    for (let c = 0; c < GRID_SIZE; c++) {
      const line: (TileData | null)[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        line.push(grid[r][c]);
      }
      line.reverse();
      const processed = processLine(line);
      processed.reverse();
      for (let r = 0; r < GRID_SIZE; r++) {
        const originalTile = grid[r][c];
        const newTile = processed[r];
        if (newTile) {
          newTile.row = r;
          newTile.col = c;
        }
        if (
          (!originalTile && newTile) ||
          (originalTile && !newTile) ||
          (originalTile && newTile && originalTile.value !== newTile.value) ||
          (originalTile && newTile && (originalTile.row !== newTile.row || originalTile.col !== newTile.col))
        ) {
          moved = true;
        }
        grid[r][c] = newTile;
      }
    }
  }

  // If moved, spawn a new tile
  let finalGrid = grid;
  if (moved) {
    const spawnResult = spawnRandomTile(grid);
    finalGrid = spawnResult.grid;
  }

  const highestTile = getHighestTileOnBoard(finalGrid);
  const isLocked = isBoardLocked(finalGrid);

  return {
    grid: finalGrid,
    moved,
    scoreGained,
    mergedCount,
    highestTile,
    isLocked,
  };
}

/**
 * Initialize a fresh 4x4 game board with 2 starting tiles
 */
export function initializeBoard(): Grid {
  let grid = createEmptyGrid();
  const first = spawnRandomTile(grid);
  grid = first.grid;
  const second = spawnRandomTile(grid);
  grid = second.grid;
  return grid;
}

/**
 * Get distinct visual theme and colors for tiles
 */
export interface TileVisual {
  bg: string;
  text: string;
  glow?: string;
  fontSize: string;
  border?: string;
}

export function getTileVisual(value: bigint): TileVisual {
  const num = Number(value);

  // Scaled font sizes to prevent UI clipping on mobile screens
  let fontSize = 'text-2xl sm:text-3xl font-bold';
  if (value >= 16384n) {
    fontSize = 'text-lg sm:text-xl font-black tracking-tight';
  } else if (value >= 1024n) {
    fontSize = 'text-xl sm:text-2xl font-bold';
  } else if (value >= 128n) {
    fontSize = 'text-2xl sm:text-3xl font-bold';
  }

  switch (num) {
    case 2:
      return { bg: 'bg-amber-100 dark:bg-amber-100/90', text: 'text-stone-800', fontSize };
    case 4:
      return { bg: 'bg-amber-200 dark:bg-amber-200/90', text: 'text-stone-800', fontSize };
    case 8:
      return { bg: 'bg-orange-400', text: 'text-white', fontSize, glow: 'shadow-orange-500/30' };
    case 16:
      return { bg: 'bg-orange-500', text: 'text-white', fontSize, glow: 'shadow-orange-500/40' };
    case 32:
      return { bg: 'bg-rose-500', text: 'text-white', fontSize, glow: 'shadow-rose-500/40' };
    case 64:
      return { bg: 'bg-red-600', text: 'text-white', fontSize, glow: 'shadow-red-600/50' };
    case 128:
      return { bg: 'bg-yellow-400', text: 'text-stone-900', fontSize, glow: 'shadow-yellow-400/50 ring-2 ring-yellow-300' };
    case 256:
      return { bg: 'bg-yellow-500', text: 'text-stone-900', fontSize, glow: 'shadow-yellow-500/60 ring-2 ring-yellow-400' };
    case 512:
      return { bg: 'bg-amber-500', text: 'text-white', fontSize, glow: 'shadow-amber-500/70 ring-2 ring-amber-300' };
    case 1024:
      return { bg: 'bg-emerald-500', text: 'text-white', fontSize, glow: 'shadow-emerald-500/70 ring-2 ring-emerald-300' };
    case 2048:
      return { bg: 'bg-cyan-500', text: 'text-white', fontSize, glow: 'shadow-cyan-500/80 ring-2 ring-cyan-200' };
    case 4096:
      return { bg: 'bg-blue-600', text: 'text-white', fontSize, glow: 'shadow-blue-600/80 ring-2 ring-blue-300' };
    case 8192:
      return { bg: 'bg-indigo-600', text: 'text-white', fontSize, glow: 'shadow-indigo-600/90 ring-2 ring-indigo-300' };
    case 16384:
      return { bg: 'bg-purple-600', text: 'text-white', fontSize, glow: 'shadow-purple-600/90 ring-2 ring-purple-300' };
    case 32768:
      return { bg: 'bg-fuchsia-600', text: 'text-white', fontSize, glow: 'shadow-fuchsia-600/90 ring-2 ring-pink-300' };
    case 65536:
      return { bg: 'bg-pink-600', text: 'text-white', fontSize, glow: 'shadow-pink-600/90 ring-2 ring-pink-200' };
    case 131072:
      return {
        bg: 'bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 animate-pulse',
        text: 'text-white',
        fontSize,
        glow: 'shadow-amber-400/90 ring-4 ring-yellow-300 shadow-2xl',
      };
    default:
      return {
        bg: 'bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-amber-400',
        text: 'text-white',
        fontSize,
        glow: 'shadow-purple-500/90 ring-2 ring-white',
      };
  }
}

import { describe, it, expect } from 'vitest';
import {
  formatTileValue,
  compareBigInt,
  formatScore,
  createEmptyGrid,
  isBoardLocked,
  moveGrid,
  serializeGrid,
  deserializeGrid,
  GRID_SIZE,
} from './gameEngine';

describe('2048 Endless Game Engine', () => {
  describe('formatTileValue', () => {
    it('formats standard integers up to 8192', () => {
      expect(formatTileValue(2n)).toBe('2');
      expect(formatTileValue(4n)).toBe('4');
      expect(formatTileValue(2048n)).toBe('2048');
      expect(formatTileValue(4096n)).toBe('4096');
      expect(formatTileValue(8192n)).toBe('8192');
    });

    it('formats compact values >= 16384', () => {
      expect(formatTileValue(16384n)).toBe('16K');
      expect(formatTileValue(32768n)).toBe('32K');
      expect(formatTileValue(65536n)).toBe('64K');
      expect(formatTileValue(131072n)).toBe('128K');
      expect(formatTileValue(1048576n)).toBe('1M');
    });
  });

  describe('compareBigInt & formatScore', () => {
    it('compares large numbers correctly', () => {
      expect(compareBigInt('1000000000000', '2000000000000')).toBe(-1);
      expect(compareBigInt('5000', '5000')).toBe(0);
      expect(compareBigInt('999999999999999999', '1')).toBe(1);
    });

    it('formats score with thousand separators', () => {
      expect(formatScore('184200')).toBe('184,200');
      expect(formatScore(14920n)).toBe('14,920');
    });
  });

  describe('isBoardLocked', () => {
    it('returns false if board has empty cells', () => {
      const grid = createEmptyGrid();
      grid[0][0] = { id: '1', value: 2n, row: 0, col: 0 };
      expect(isBoardLocked(grid)).toBe(false);
    });

    it('returns false if full board has adjacent horizontal matches', () => {
      const grid = createEmptyGrid();
      let val = 2n;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          grid[r][c] = { id: `${r}-${c}`, value: val++, row: r, col: c };
        }
      }
      // Make a horizontal match
      grid[0][1] = { id: 'match', value: grid[0][0]!.value, row: 0, col: 1 };
      expect(isBoardLocked(grid)).toBe(false);
    });

    it('returns false if full board has adjacent vertical matches', () => {
      const grid = createEmptyGrid();
      let val = 2n;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          grid[r][c] = { id: `${r}-${c}`, value: val++, row: r, col: c };
        }
      }
      // Make a vertical match
      grid[1][0] = { id: 'match', value: grid[0][0]!.value, row: 1, col: 0 };
      expect(isBoardLocked(grid)).toBe(false);
    });

    it('returns true when board is full and no valid moves exist', () => {
      const grid = createEmptyGrid();
      // Alternating chessboard-like values: 2, 4, 8, 16, etc. so no two adjacent match
      const values = [
        [2n, 4n, 2n, 4n],
        [4n, 2n, 4n, 2n],
        [8n, 16n, 8n, 16n],
        [16n, 8n, 16n, 8n],
      ];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          grid[r][c] = { id: `${r}-${c}`, value: values[r][c], row: r, col: c };
        }
      }
      expect(isBoardLocked(grid)).toBe(true);
    });
  });

  describe('moveGrid endless mechanics', () => {
    it('merges 2048 tiles into 4096 and adds to score', () => {
      const grid = createEmptyGrid();
      grid[0][0] = { id: '1', value: 2048n, row: 0, col: 0 };
      grid[0][1] = { id: '2', value: 2048n, row: 0, col: 1 };

      const result = moveGrid(grid, 'LEFT');
      expect(result.moved).toBe(true);
      expect(result.scoreGained).toBe(4096n);
      expect(result.highestTile).toBe(4096n);
      expect(result.grid[0][0]?.value).toBe(4096n);
    });

    it('merges 65536 into 131072 (physical limit)', () => {
      const grid = createEmptyGrid();
      grid[3][2] = { id: '1', value: 65536n, row: 3, col: 2 };
      grid[3][3] = { id: '2', value: 65536n, row: 3, col: 3 };

      const result = moveGrid(grid, 'RIGHT');
      expect(result.moved).toBe(true);
      expect(result.scoreGained).toBe(131072n);
      expect(result.grid[3][3]?.value).toBe(131072n);
    });

    it('does not merge multiple times in a single slide: [2, 2, 4, 8] -> [4, 4, 8, empty]', () => {
      const grid = createEmptyGrid();
      grid[0][0] = { id: '1', value: 2n, row: 0, col: 0 };
      grid[0][1] = { id: '2', value: 2n, row: 0, col: 1 };
      grid[0][2] = { id: '3', value: 4n, row: 0, col: 2 };
      grid[0][3] = { id: '4', value: 8n, row: 0, col: 3 };

      const result = moveGrid(grid, 'LEFT');
      expect(result.moved).toBe(true);
      expect(result.grid[0][0]?.value).toBe(4n);
      expect(result.grid[0][1]?.value).toBe(4n);
      expect(result.grid[0][2]?.value).toBe(8n);
    });
  });

  describe('serializeGrid and deserializeGrid', () => {
    it('serializes BigInt values to string and deserializes back correctly', () => {
      const grid = createEmptyGrid();
      grid[1][2] = { id: 'tile-test-1', value: 2048n, row: 1, col: 2, isNew: true };
      grid[3][3] = { id: 'tile-test-2', value: 65536n, row: 3, col: 3, isMerged: true };

      const serialized = serializeGrid(grid);
      expect(serialized[1][2]?.value).toBe('2048');
      expect(serialized[3][3]?.value).toBe('65536');
      expect(serialized[0][0]).toBeNull();

      // Ensure JSON.stringify works without BigInt error
      const jsonStr = JSON.stringify(serialized);
      expect(jsonStr).toContain('"2048"');
      expect(jsonStr).toContain('"65536"');

      // Deserialize
      const reconstructed = deserializeGrid(JSON.parse(jsonStr));
      expect(reconstructed[1][2]?.value).toBe(2048n);
      expect(reconstructed[1][2]?.id).toBe('tile-test-1');
      expect(reconstructed[3][3]?.value).toBe(65536n);
      expect(reconstructed[0][0]).toBeNull();
    });
  });
});

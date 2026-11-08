export type Difficulty = 'very-easy' | 'easy' | 'medium' | 'hard' | 'expert';

export type Puzzle = {
  puzzle: number[];
  solution: number[];
  difficulty: Difficulty;
  seed: string;
};

export const difficulties: { id: Difficulty; label: string; clues: number }[] = [
  { id: 'very-easy', label: 'Very Easy', clues: 58 },
  { id: 'easy', label: 'Easy', clues: 48 },
  { id: 'medium', label: 'Medium', clues: 38 },
  { id: 'hard', label: 'Hard', clues: 30 },
  { id: 'expert', label: 'Expert', clues: 24 },
];

const ALL_COLORS_MASK = 0b1111111110;

function hashSeed(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0 || 1;
}

function makeRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function shuffledGroups(random: () => number): number[] {
  const groups = shuffle([0, 1, 2], random);
  return groups.flatMap((group) =>
    shuffle([0, 1, 2], random).map((within) => group * 3 + within),
  );
}

export function createSolvedGrid(seed: string): number[] {
  const random = makeRandom(seed);
  const rows = shuffledGroups(random);
  const columns = shuffledGroups(random);
  const colors = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const transpose = random() > 0.5;

  return Array.from({ length: 81 }, (_, index) => {
    let row = Math.floor(index / 9);
    let column = index % 9;
    if (transpose) [row, column] = [column, row];
    const pattern =
      (rows[row] * 3 + Math.floor(rows[row] / 3) + columns[column]) % 9;
    return colors[pattern];
  });
}

function getCandidateMask(
  index: number,
  rowMasks: number[],
  columnMasks: number[],
  boxMasks: number[],
): number {
  const row = Math.floor(index / 9);
  const column = index % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
  return ALL_COLORS_MASK & ~(rowMasks[row] | columnMasks[column] | boxMasks[box]);
}

function bitCount(value: number): number {
  let count = 0;
  for (; value; value &= value - 1) count += 1;
  return count;
}

export function countSolutions(board: number[], limit = 2): number {
  if (board.length !== 81 || limit < 1) return 0;
  const working = [...board];
  const rowMasks = Array(9).fill(0) as number[];
  const columnMasks = Array(9).fill(0) as number[];
  const boxMasks = Array(9).fill(0) as number[];

  for (let index = 0; index < 81; index += 1) {
    const color = working[index];
    if (color === 0) continue;
    if (!Number.isInteger(color) || color < 1 || color > 9) return 0;
    const row = Math.floor(index / 9);
    const column = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    const bit = 1 << color;
    if ((rowMasks[row] | columnMasks[column] | boxMasks[box]) & bit) return 0;
    rowMasks[row] |= bit;
    columnMasks[column] |= bit;
    boxMasks[box] |= bit;
  }

  let solutions = 0;
  function search(): void {
    if (solutions >= limit) return;
    let bestIndex = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let index = 0; index < 81; index += 1) {
      if (working[index] !== 0) continue;
      const mask = getCandidateMask(index, rowMasks, columnMasks, boxMasks);
      const count = bitCount(mask);
      if (count === 0) return;
      if (count < bestCount) {
        bestIndex = index;
        bestMask = mask;
        bestCount = count;
        if (count === 1) break;
      }
    }

    if (bestIndex === -1) {
      solutions += 1;
      return;
    }

    const row = Math.floor(bestIndex / 9);
    const column = bestIndex % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
    for (let color = 1; color <= 9; color += 1) {
      const bit = 1 << color;
      if (!(bestMask & bit)) continue;
      working[bestIndex] = color;
      rowMasks[row] |= bit;
      columnMasks[column] |= bit;
      boxMasks[box] |= bit;
      search();
      working[bestIndex] = 0;
      rowMasks[row] ^= bit;
      columnMasks[column] ^= bit;
      boxMasks[box] ^= bit;
      if (solutions >= limit) return;
    }
  }
  search();
  return solutions;
}

export function getCandidates(board: number[], index: number): number[] {
  if (board.length !== 81 || index < 0 || index > 80 || board[index] !== 0) {
    return [];
  }
  const row = Math.floor(index / 9);
  const column = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  const used = new Set<number>();
  for (let offset = 0; offset < 9; offset += 1) {
    used.add(board[row * 9 + offset]);
    used.add(board[offset * 9 + column]);
  }
  for (let boxY = 0; boxY < 3; boxY += 1) {
    for (let boxX = 0; boxX < 3; boxX += 1) {
      used.add(board[(boxRow + boxY) * 9 + boxColumn + boxX]);
    }
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((color) => !used.has(color));
}

export function isPlacementValid(
  board: number[],
  index: number,
  color: number,
): boolean {
  if (index < 0 || index > 80 || color < 1 || color > 9) return false;
  const row = Math.floor(index / 9);
  const column = index % 9;
  for (let offset = 0; offset < 9; offset += 1) {
    const rowIndex = row * 9 + offset;
    const columnIndex = offset * 9 + column;
    if (rowIndex !== index && board[rowIndex] === color) return false;
    if (columnIndex !== index && board[columnIndex] === color) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  for (let boxY = 0; boxY < 3; boxY += 1) {
    for (let boxX = 0; boxX < 3; boxX += 1) {
      const boxIndex = (boxRow + boxY) * 9 + boxColumn + boxX;
      if (boxIndex !== index && board[boxIndex] === color) return false;
    }
  }
  return true;
}

export function createDailySeed(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `daily-${date.getFullYear()}-${month}-${day}`;
}

export function generatePuzzle(
  difficulty: Difficulty,
  seed = `${Date.now()}-${Math.random()}`,
): Puzzle {
  const random = makeRandom(seed);
  const solution = createSolvedGrid(`${seed}-solution`);
  const puzzle = [...solution];
  const target = difficulties.find((item) => item.id === difficulty)?.clues ?? 48;
  const order = shuffle(
    Array.from({ length: 81 }, (_, index) => index),
    random,
  );
  let clueCount = 81;

  for (const index of order) {
    if (clueCount <= target) break;
    const previous = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      clueCount -= 1;
    } else {
      puzzle[index] = previous;
    }
  }
  return { puzzle, solution, difficulty, seed };
}

export type Difficulty = 'very-easy' | 'easy' | 'medium' | 'hard' | 'expert';
export type BoardSize = 4 | 6 | 9;
export const boardModes = [
  { size: 4 as BoardSize, boxRows: 2, boxColumns: 2, label: '4 × 4', description: '2 × 2 blocks' },
  { size: 6 as BoardSize, boxRows: 2, boxColumns: 3, label: '6 × 6', description: '2 × 3 blocks' },
  { size: 9 as BoardSize, boxRows: 3, boxColumns: 3, label: '9 × 9', description: '3 × 3 blocks' },
];
export const difficulties: { id: Difficulty; label: string; clues: number }[] = [
  { id: 'very-easy', label: 'Very Easy', clues: 58 },
  { id: 'easy', label: 'Easy', clues: 48 },
  { id: 'medium', label: 'Medium', clues: 38 },
  { id: 'hard', label: 'Hard', clues: 30 },
  { id: 'expert', label: 'Expert', clues: 24 },
];
export type Puzzle = {
  puzzle: number[]; solution: number[]; difficulty: Difficulty; seed: string; size: BoardSize;
};
export function modeFor(size: BoardSize) {
  const mode = boardModes.find((mode) => mode.size === size);
  if (!mode) throw new Error('Unsupported board size');
  return mode;
}
function randomFor(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export function createSolvedGrid(seed: string, size: BoardSize = 9): number[] {
  const { boxRows, boxColumns } = modeFor(size);
  const random = randomFor(seed);
  const groups = (within: number) => shuffle(range(size / within), random)
    .flatMap((group) => shuffle(range(within), random).map((i) => group * within + i));
  const rows = groups(boxRows);
  const columns = groups(boxColumns);
  const colors = shuffle(range(size).map((i) => i + 1), random);
  return range(size * size).map((i) => colors[
    (rows[Math.floor(i / size)] * boxColumns + Math.floor(rows[Math.floor(i / size)] / boxRows) + columns[i % size]) % size
  ]);
}
export function isPlacementValid(board: number[], index: number, color: number, size: BoardSize = 9): boolean {
  if (board.length !== size * size || !Number.isInteger(index) || index < 0 || index >= board.length ||
      !Number.isInteger(color) || color < 1 || color > size) return false;
  const { boxRows, boxColumns } = modeFor(size);
  const row = Math.floor(index / size), column = index % size;
  for (let i = 0; i < board.length; i++) {
    if (i === index || board[i] !== color) continue;
    const r = Math.floor(i / size), c = i % size;
    if (r === row || c === column ||
        (Math.floor(r / boxRows) === Math.floor(row / boxRows) &&
         Math.floor(c / boxColumns) === Math.floor(column / boxColumns))) return false;
  }
  return true;
}
export function getCandidates(board: number[], index: number, size: BoardSize = 9): number[] {
  if (board[index] !== 0) return [];
  return range(size).map((i) => i + 1).filter((color) => isPlacementValid(board, index, color, size));
}
// MRV backtracking, capped at two solutions for carving. Masks keep 9×9 generation fast.
function searchSolutions(board: number[], size: BoardSize, limit: number): { count: number; solution: number[] | null } {
  if (board.length !== size * size) return { count: 0, solution: null };
  const { boxRows, boxColumns } = modeFor(size);
  const work = [...board], rows = Array(size).fill(0), columns = Array(size).fill(0), boxes = Array(size).fill(0);
  const boxOf = (r: number, c: number) => Math.floor(r / boxRows) * (size / boxColumns) + Math.floor(c / boxColumns);
  const all = ((1 << (size + 1)) - 1) ^ 1;
  for (let i = 0; i < work.length; i++) {
    const value = work[i];
    if (!Number.isInteger(value) || value < 0 || value > size) return { count: 0, solution: null };
    if (!value) continue;
    const r = Math.floor(i / size), c = i % size, b = boxOf(r, c), bit = 1 << value;
    if ((rows[r] | columns[c] | boxes[b]) & bit) return { count: 0, solution: null };
    rows[r] |= bit; columns[c] |= bit; boxes[b] |= bit;
  }
  let count = 0, solution: number[] | null = null;
  function search() {
    let best = -1, mask = 0, min = size + 1;
    for (let i = 0; i < work.length; i++) {
      if (work[i]) continue;
      const r = Math.floor(i / size), c = i % size;
      const candidate = all & ~(rows[r] | columns[c] | boxes[boxOf(r, c)]);
      if (!candidate) return;
      let bits = candidate, n = 0;
      while (bits) { bits &= bits - 1; n++; }
      if (n < min) { best = i; mask = candidate; min = n; if (n === 1) break; }
    }
    if (best < 0) { count++; solution ??= [...work]; return; }
    const r = Math.floor(best / size), c = best % size, b = boxOf(r, c);
    for (let value = 1; value <= size && count < limit; value++) {
      const bit = 1 << value;
      if (!(mask & bit)) continue;
      work[best] = value; rows[r] |= bit; columns[c] |= bit; boxes[b] |= bit;
      search();
      work[best] = 0; rows[r] ^= bit; columns[c] ^= bit; boxes[b] ^= bit;
    }
  }
  search();
  return { count, solution };
}
export function countSolutions(board: number[], limit = 2, size: BoardSize = 9): number {
  return limit < 1 ? 0 : searchSolutions(board, size, limit).count;
}
export function solvePuzzle(board: number[], size: BoardSize = 9): number[] | null {
  return searchSolutions(board, size, 1).solution;
}
export function createDailySeed(date = new Date()): string {
  return `daily-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function generatePuzzle(difficulty: Difficulty, seed = `${Date.now()}-${Math.random()}`, size: BoardSize = 9): Puzzle {
  const level = difficulties.findIndex((d) => d.id === difficulty);
  if (level < 0) throw new Error('Unsupported difficulty');
  const target = size === 9 ? difficulties[level].clues : (size === 4 ? [12, 10, 8, 6, 4] : [27, 23, 19, 15, 12])[level];
  const solution = createSolvedGrid(`${seed}-solution`, size), puzzle = [...solution];
  let clues = size * size;
  for (const index of shuffle(range(clues), randomFor(seed))) {
    if (clues <= target) break;
    const value = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle, 2, size) === 1) clues--;
    else puzzle[index] = value;
  }
  return { puzzle, solution, difficulty, seed, size };
}

import { countSolutions, difficulties, generatePuzzle, isPlacementValid, modeFor, type BoardSize, type Difficulty } from './sudoku';
import type { GameTheme } from '@/constants/colors';

export type Screen = 'home' | 'game' | 'addons' | 'leaderboards';
export type UndoFrame = { board: number[]; notes: number[][] };
export type PendingResult = { id: string; board: number[] };
export type SavedGame = {
  board: number[]; solution: number[]; clues: boolean[]; notes: number[][];
  size: BoardSize; difficulty: Difficulty; theme: GameTheme; daily: boolean; dailySeed: string | null;
  elapsedSeconds: number; selectedCell: number | null; selectedColor: number | null; notesMode: boolean;
  paused: boolean; complete: boolean; completedGames: number; history: UndoFrame[]; status: string;
  screen: Screen; hasPuzzle: boolean; rankedId: string | null; rankingStatus: string;
  rankingAccepted: boolean;
  pendingResults: PendingResult[];
};
export function buildGame(difficulty: Difficulty, theme: GameTheme, dailySeed: string | null,
  completedGames: number, size: BoardSize): SavedGame {
  const puzzle = generatePuzzle(difficulty, dailySeed ? `${dailySeed}-${size}` : undefined, size);
  return {
    board: puzzle.puzzle, solution: puzzle.solution, clues: puzzle.puzzle.map(Boolean),
    notes: Array.from({ length: size * size }, () => []), size, difficulty, theme,
    daily: !!dailySeed, dailySeed, elapsedSeconds: 0, selectedCell: null, selectedColor: null,
    notesMode: false, paused: false, complete: false, completedGames, history: [],
    status: 'Choose a color, then tap an empty square.', screen: 'game', hasPuzzle: true,
    rankedId: null, rankingStatus: '', rankingAccepted: false,
    pendingResults: [],
  };
}
export function snapshot(game: SavedGame): UndoFrame {
  return { board: [...game.board], notes: game.notes.map((notes) => [...notes]) };
}
export function detachOnlineRankings(game: SavedGame): SavedGame {
  return {
    ...game, rankedId: null, pendingResults: [], rankingAccepted: false,
    rankingStatus: '', status: 'Online rankings are off. Your puzzle is available as practice.',
  };
}
export function conflictIndexes(board: number[], size: BoardSize): Set<number> {
  return new Set(board.flatMap((color, index) => color && !isPlacementValid(board, index, color, size) ? [index] : []));
}
const themeNames = ['classic', 'pastel', 'neon', 'dark'];
// Legacy 9×9 saves are upgraded in place; damaged saves are never silently overwritten.
export function parseSavedGame(raw: string): SavedGame {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Saved puzzle is damaged.');
  const size = value.size ?? 9;
  if (![4, 6, 9].includes(size)) throw new Error('Unsupported saved board.');
  const length = size * size;
  const values = (v: unknown): v is number[] => Array.isArray(v) && v.length === length &&
    v.every((n) => Number.isInteger(n) && n >= 0 && n <= size);
  const notesValid = (notes: unknown) => Array.isArray(notes) && notes.length === length &&
    notes.every((cell) => Array.isArray(cell) && cell.every((n) => Number.isInteger(n) && n >= 1 && n <= size) && new Set(cell).size === cell.length);
  if (!values(value.board) || !values(value.solution) || value.solution.some((n: number) => n === 0) ||
      countSolutions(value.solution, 2, size) !== 1 ||
      !Array.isArray(value.clues) || value.clues.length !== length || value.clues.some((clue: unknown) => typeof clue !== 'boolean') ||
      !notesValid(value.notes) || !difficulties.some((d) => d.id === value.difficulty) ||
      !themeNames.includes(value.theme) || !Number.isSafeInteger(value.elapsedSeconds) || value.elapsedSeconds < 0 ||
      !Number.isSafeInteger(value.completedGames) || value.completedGames < 0 ||
      typeof value.complete !== 'boolean' || typeof value.daily !== 'boolean' ||
      typeof value.status !== 'string' ||
      !(value.dailySeed === null || typeof value.dailySeed === 'string') ||
      !(value.hasPuzzle === undefined || typeof value.hasPuzzle === 'boolean') ||
      !(value.rankingStatus === undefined || typeof value.rankingStatus === 'string') ||
      !(value.rankingAccepted === undefined || typeof value.rankingAccepted === 'boolean') ||
      typeof value.notesMode !== 'boolean' ||
      !(value.selectedCell === null || Number.isInteger(value.selectedCell) && value.selectedCell >= 0 && value.selectedCell < length) ||
      !(value.selectedColor === null || Number.isInteger(value.selectedColor) && value.selectedColor >= 1 && value.selectedColor <= size) ||
      value.board.some((n: number, i: number) => value.clues[i] && n !== value.solution[i]) ||
      !Array.isArray(value.history) || value.history.length > 40 ||
      value.history.some((frame: UndoFrame) => !values(frame.board) || !notesValid(frame.notes) ||
        frame.board.some((n, i) => value.clues[i] && n !== value.solution[i])) ||
      (value.complete && !value.board.every((n: number, i: number) => n === value.solution[i])) ||
      !(value.rankedId == null || typeof value.rankedId === 'string' && /^[a-f0-9-]{36}$/.test(value.rankedId))) {
    throw new Error('Saved puzzle is damaged. It has been kept on this device, not replaced.');
  }
  const cluesOnly = value.board.map((n: number, i: number) => value.clues[i] ? n : 0);
  if (countSolutions(cluesOnly, 2, size) !== 1) throw new Error('Saved puzzle does not have a unique solution.');
  modeFor(size);
  const pendingResults = value.pendingResults ?? (
    value.complete && value.rankedId && !value.rankingAccepted ? [{ id: value.rankedId, board: value.board }] : []);
  if (!Array.isArray(pendingResults) || pendingResults.some((result: PendingResult) =>
    !result || typeof result.id !== 'string' || !/^[a-f0-9-]{36}$/.test(result.id) ||
    !Array.isArray(result.board) || ![16, 36, 81].includes(result.board.length) ||
    result.board.some((n) => !Number.isInteger(n) || n < 1 || n > Math.sqrt(result.board.length)))) {
    throw new Error('Saved ranking results are damaged. Storage has not been replaced.');
  }
  return {
    ...value, size, screen: 'home', paused: true, hasPuzzle: value.hasPuzzle ?? true,
    rankedId: value.rankedId ?? null, rankingStatus: value.rankingStatus ?? '',
    rankingAccepted: value.rankingAccepted === true,
    pendingResults,
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { paletteByTheme, type GameTheme } from '@/constants/colors';
import {
  createDailySeed,
  difficulties,
  generatePuzzle,
  isPlacementValid,
  type Difficulty,
} from '@/lib/sudoku';

type UndoFrame = {
  board: number[];
  notes: number[][];
};

type SavedGame = {
  board: number[];
  solution: number[];
  clues: boolean[];
  notes: number[][];
  difficulty: Difficulty;
  theme: GameTheme;
  daily: boolean;
  dailySeed: string | null;
  elapsedSeconds: number;
  selectedCell: number | null;
  selectedColor: number | null;
  notesMode: boolean;
  paused: boolean;
  complete: boolean;
  completedGames: number;
  history: UndoFrame[];
  status: string;
};

const STORAGE_KEY = 'color-sudoku-mobile.save.v1';
const MAX_UNDO = 40;
const THEME_UNLOCKS: Partial<Record<GameTheme, number>> = {
  pastel: 1,
  neon: 3,
  dark: 5,
};

function buildGame(
  difficulty: Difficulty,
  theme: GameTheme,
  daily: boolean,
  completedGames: number,
): SavedGame {
  const dailySeed = daily ? createDailySeed() : null;
  const puzzle = generatePuzzle(difficulty, dailySeed ?? `${Date.now()}-${Math.random()}`);
  return {
    board: [...puzzle.puzzle],
    solution: puzzle.solution,
    clues: puzzle.puzzle.map((color) => color !== 0),
    notes: Array.from({ length: 81 }, () => []),
    difficulty,
    theme,
    daily,
    dailySeed,
    elapsedSeconds: 0,
    selectedCell: null,
    selectedColor: null,
    notesMode: false,
    paused: false,
    complete: false,
    completedGames,
    history: [],
    status: 'Choose a color, then tap an empty square.',
  };
}

function validSavedGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== 'object') return false;
  const saved = value as SavedGame;
  return (
    Array.isArray(saved.board) &&
    saved.board.length === 81 &&
    Array.isArray(saved.solution) &&
    saved.solution.length === 81 &&
    Array.isArray(saved.clues) &&
    saved.clues.length === 81 &&
    Array.isArray(saved.notes) &&
    saved.notes.length === 81 &&
    Array.isArray(saved.history)
  );
}

function conflictIndexes(board: number[]): Set<number> {
  const conflicts = new Set<number>();
  const groups: number[][] = [];
  for (let row = 0; row < 9; row += 1) {
    groups.push(Array.from({ length: 9 }, (_, column) => row * 9 + column));
  }
  for (let column = 0; column < 9; column += 1) {
    groups.push(Array.from({ length: 9 }, (_, row) => row * 9 + column));
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      const group: number[] = [];
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          group.push((boxRow * 3 + row) * 9 + boxColumn * 3 + column);
        }
      }
      groups.push(group);
    }
  }
  for (const group of groups) {
    const values = new Map<number, number[]>();
    for (const index of group) {
      const color = board[index];
      if (!color) continue;
      const indexes = values.get(color) ?? [];
      indexes.push(index);
      values.set(color, indexes);
    }
    for (const indexes of values.values()) {
      if (indexes.length > 1) indexes.forEach((index) => conflicts.add(index));
    }
  }
  return conflicts;
}

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function snapshot(game: SavedGame): UndoFrame {
  return {
    board: [...game.board],
    notes: game.notes.map((cellNotes) => [...cellNotes]),
  };
}

export function useColorSudokuGame() {
  const [game, setGame] = useState<SavedGame>(() =>
    buildGame('very-easy', 'classic', false, 0),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (validSavedGame(parsed)) {
          setGame({
            ...parsed,
            completedGames: Number.isInteger(parsed.completedGames)
              ? parsed.completedGames
              : 0,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(game)).catch(
      () => undefined,
    );
  }, [game, ready]);

  useEffect(() => {
    if (!ready || game.paused || game.complete) return;
    const timer = setInterval(() => {
      setGame((current) =>
        current.paused || current.complete
          ? current
          : { ...current, elapsedSeconds: current.elapsedSeconds + 1 },
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [game.complete, game.paused, ready]);

  const conflicts = useMemo(() => conflictIndexes(game.board), [game.board]);
  const unlockedThemes = useMemo(
    () =>
      (['classic', 'pastel', 'neon', 'dark'] as GameTheme[]).filter(
        (theme) =>
          theme === 'classic' ||
          game.completedGames >= (THEME_UNLOCKS[theme] ?? 0),
      ),
    [game.completedGames],
  );

  const onColorSelect = useCallback((colorId: number) => {
    if (colorId < 1 || colorId > 9) return;
    setGame((current) =>
      current.paused || current.complete
        ? current
        : {
            ...current,
            selectedColor: colorId,
            status: `${paletteByTheme[current.theme][colorId - 1].name} selected. Choose an empty square.`,
          },
    );
  }, []);

  const onCellSelect = useCallback((index: number) => {
    setGame((current) => {
      if (
        current.paused ||
        current.complete ||
        !Number.isInteger(index) ||
        index < 0 ||
        index > 80
      ) {
        return current;
      }
      if (current.clues[index]) {
        return {
          ...current,
          selectedCell: index,
          status: 'That color is a starting clue.',
        };
      }
      const selected = { ...current, selectedCell: index };
      if (current.selectedColor === null) return selected;

      const history = [...current.history, snapshot(current)].slice(-MAX_UNDO);
      if (current.notesMode) {
        if (current.board[index] !== 0) {
          return { ...selected, status: 'Pencil marks go in empty squares.' };
        }
        const notes = current.notes.map((cellNotes) => [...cellNotes]);
        notes[index] = notes[index].includes(current.selectedColor)
          ? notes[index].filter((color) => color !== current.selectedColor)
          : [...notes[index], current.selectedColor].sort((a, b) => a - b);
        return {
          ...selected,
          notes,
          history,
          status: 'Pencil mark updated.',
        };
      }

      const board = [...current.board];
      board[index] = current.selectedColor;
      const notes = current.notes.map((cellNotes) => [...cellNotes]);
      notes[index] = [];
      const conflict = !isPlacementValid(board, index, current.selectedColor);
      const solved = board.every(
        (color, cellIndex) => color !== 0 && color === current.solution[cellIndex],
      );
      return {
        ...selected,
        board,
        notes,
        history,
        complete: solved,
        completedGames: solved
          ? current.completedGames + 1
          : current.completedGames,
        status: solved
          ? 'Puzzle solved. Great work!'
          : conflict
            ? 'That color appears elsewhere in this row, column, or block.'
            : 'Color placed.',
      };
    });
  }, []);

  const onToggleNotes = useCallback(() => {
    setGame((current) =>
      current.paused || current.complete
        ? current
        : {
            ...current,
            notesMode: !current.notesMode,
            status: current.notesMode ? 'Pencil marks off.' : 'Pencil marks on.',
          },
    );
  }, []);

  const onClear = useCallback(() => {
    setGame((current) => {
      const index = current.selectedCell;
      if (
        current.paused ||
        current.complete ||
        index === null ||
        current.clues[index]
      ) {
        return current;
      }
      const board = [...current.board];
      const notes = current.notes.map((cellNotes) => [...cellNotes]);
      board[index] = 0;
      notes[index] = [];
      return {
        ...current,
        board,
        notes,
        history: [...current.history, snapshot(current)].slice(-MAX_UNDO),
        status: 'Square cleared.',
      };
    });
  }, []);

  const onUndo = useCallback(() => {
    setGame((current) => {
      if (
        current.paused ||
        current.complete ||
        current.history.length === 0
      ) {
        return current;
      }
      const history = [...current.history];
      const previous = history.pop()!;
      return {
        ...current,
        board: previous.board,
        notes: previous.notes,
        history,
        status: 'Last move undone.',
      };
    });
  }, []);

  const onPause = useCallback(() => {
    setGame((current) =>
      current.complete ? current : { ...current, paused: true, status: 'Game paused.' },
    );
  }, []);

  const onResume = useCallback(() => {
    setGame((current) => ({ ...current, paused: false, status: 'Game resumed.' }));
  }, []);

  const onNewGame = useCallback((difficulty: Difficulty) => {
    setGame((current) =>
      buildGame(difficulty, current.theme, false, current.completedGames),
    );
  }, []);

  const onDailyChallenge = useCallback(() => {
    setGame((current) =>
      buildGame('medium', current.theme, true, current.completedGames),
    );
  }, []);

  const onThemeChange = useCallback((theme: GameTheme) => {
    setGame((current) => {
      const requiredWins = THEME_UNLOCKS[theme] ?? 0;
      if (theme !== 'classic' && current.completedGames < requiredWins) {
        return {
          ...current,
          status: `Solve ${requiredWins} puzzles to unlock the ${theme} palette.`,
        };
      }
      return { ...current, theme };
    });
  }, []);

  const onHint = useCallback(() => {
    setGame((current) =>
      ({
        ...current,
        status: 'Paid hints will be available after Google Play billing is connected.',
      }),
    );
  }, []);

  return {
    ready,
    board: game.board,
    solution: game.solution,
    clues: game.clues,
    notes: game.notes,
    difficulty: game.difficulty,
    theme: game.theme,
    daily: game.daily,
    elapsed: formatTime(game.elapsedSeconds),
    selectedCell: game.selectedCell,
    selectedColor: game.selectedColor,
    notesMode: game.notesMode,
    paused: game.paused,
    complete: game.complete,
    completedGames: game.completedGames,
    unlockedThemes,
    palette: paletteByTheme[game.theme],
    conflicts,
    status: game.status,
    canUndo: game.history.length > 0,
    hintPrice: '$0.25',
    hintAvailable: false,
    difficultyOptions: difficulties,
    onCellSelect,
    onColorSelect,
    onToggleNotes,
    onClear,
    onUndo,
    onPause,
    onResume,
    onNewGame,
    onDailyChallenge,
    onThemeChange,
    onHint,
  };
}

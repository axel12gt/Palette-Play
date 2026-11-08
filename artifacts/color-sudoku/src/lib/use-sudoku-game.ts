import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createDailySeed,
  DIFFICULTIES,
  generatePuzzle,
  isPlacementValid,
  PALETTE,
  type Difficulty,
  type PaletteColor,
} from './sudoku';

export type Theme = 'classic' | 'pastel' | 'neon' | 'dark';

type UndoFrame = {
  board: number[];
  notes: number[][];
};

type SavedGame = {
  board: number[];
  clues: boolean[];
  solution: number[];
  notes: number[][];
  difficulty: Difficulty;
  theme: Theme;
  daily: boolean;
  dailySeed: string | null;
  elapsedSeconds: number;
  selectedCell: number | null;
  selectedColor: number | null;
  notesMode: boolean;
  paused: boolean;
  complete: boolean;
  history: UndoFrame[];
  statusMessage: string;
  completedGames: number;
  updatedAt: number;
};

const SAVE_KEY = 'color-sudoku.save.v1';
const THEME_KEY = 'color-sudoku.theme.v1';
const DAILY_COMPLETIONS_KEY = 'color-sudoku.daily-completions.v1';
const MAX_UNDO = 40;
const THEME_UNLOCKS: Partial<Record<Theme, number>> = {
  pastel: 1,
  neon: 3,
  dark: 5,
};
const THEME_PALETTES: Record<Theme, string[]> = {
  classic: [
    '#ee5b60',
    '#4285e9',
    '#49a878',
    '#f2c84b',
    '#f28a44',
    '#9a6bd1',
    '#e679a8',
    '#39aeb2',
    '#78828f',
  ],
  pastel: [
    '#ed858d',
    '#87aeea',
    '#77bd98',
    '#e9cb70',
    '#eea26e',
    '#a78bcc',
    '#df91b2',
    '#72b9ba',
    '#8f9ba9',
  ],
  neon: [
    '#ff3158',
    '#19aaff',
    '#37ed67',
    '#f6eb27',
    '#ff821f',
    '#b34aff',
    '#ff48bd',
    '#00d9d2',
    '#d5e2f1',
  ],
  dark: [
    '#ff777d',
    '#6caaff',
    '#70d69c',
    '#f3d46b',
    '#ffab69',
    '#bd93ee',
    '#f09bc0',
    '#67d0d0',
    '#aeb8c6',
  ],
};

function newSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newGame(
  difficulty: Difficulty,
  daily: boolean,
  theme: Theme,
  completedGames = 0,
): SavedGame {
  const dailySeed = daily ? createDailySeed() : null;
  const puzzle = generatePuzzle(
    difficulty,
    dailySeed ?? newSeed(),
  );

  return {
    board: [...puzzle.puzzle],
    clues: puzzle.puzzle.map((value) => value !== 0),
    solution: puzzle.solution,
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
    history: [],
    statusMessage: 'Choose a color, then tap an empty square.',
    completedGames,
    updatedAt: Date.now(),
  };
}

function readSavedGame(): SavedGame | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedGame;
    if (
      !Array.isArray(saved.board) ||
      saved.board.length !== 81 ||
      !Array.isArray(saved.solution) ||
      saved.solution.length !== 81 ||
      !Array.isArray(saved.notes) ||
      saved.notes.length !== 81
    ) {
      return null;
    }
    return {
      ...saved,
      completedGames: Number.isInteger(saved.completedGames)
        ? saved.completedGames
        : 0,
    };
  } catch {
    return null;
  }
}

function getConflictIndexes(board: number[]): Set<number> {
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
    const seen = new Map<number, number[]>();
    for (const index of group) {
      const color = board[index];
      if (!color) continue;
      const indexes = seen.get(color) ?? [];
      indexes.push(index);
      seen.set(color, indexes);
    }
    for (const indexes of seen.values()) {
      if (indexes.length > 1) {
        for (const index of indexes) conflicts.add(index);
      }
    }
  }
  return conflicts;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function makeUndoFrame(game: SavedGame): UndoFrame {
  return {
    board: [...game.board],
    notes: game.notes.map((cellNotes) => [...cellNotes]),
  };
}

export function useSudokuGame() {
  const [game, setGame] = useState<SavedGame>(() => {
    const saved = readSavedGame();
    if (saved) return saved;

    let theme: Theme = 'classic';
    if (typeof window !== 'undefined') {
      const storedTheme = window.localStorage.getItem(THEME_KEY);
      if (
        storedTheme === 'classic' ||
        storedTheme === 'pastel' ||
        storedTheme === 'neon' ||
        storedTheme === 'dark'
      ) {
        theme = storedTheme;
      }
    }
    return newGame('very-easy', false, theme);
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(game));
      window.localStorage.setItem(THEME_KEY, game.theme);
    } catch {
      // The current session remains playable if storage is unavailable.
    }
  }, [game]);

  useEffect(() => {
    if (game.paused || game.complete) return;
    const interval = window.setInterval(() => {
      setGame((current) =>
        current.paused || current.complete
          ? current
          : {
              ...current,
              elapsedSeconds: current.elapsedSeconds + 1,
              updatedAt: Date.now(),
            },
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, [game.paused, game.complete]);

  const conflicts = useMemo(() => getConflictIndexes(game.board), [game.board]);
  const palette = useMemo(
    () =>
      PALETTE.map((color, index) => ({
        ...color,
        hex: THEME_PALETTES[game.theme][index],
      })),
    [game.theme],
  );
  const unlockedThemes = useMemo(
    () =>
      (['classic', 'pastel', 'neon', 'dark'] as Theme[]).filter(
        (theme) =>
          theme === 'classic' ||
          game.completedGames >= (THEME_UNLOCKS[theme] ?? 0),
      ),
    [game.completedGames],
  );

  const cells = useMemo(
    () =>
      game.board.map((value, index) => {
        const row = Math.floor(index / 9);
        const column = index % 9;
        const selected = game.selectedCell;
        const selectedRow =
          selected === null ? -1 : Math.floor(selected / 9);
        const selectedColumn = selected === null ? -1 : selected % 9;
        const related =
          selected !== null &&
          (row === selectedRow ||
            column === selectedColumn ||
            (Math.floor(row / 3) === Math.floor(selectedRow / 3) &&
              Math.floor(column / 3) === Math.floor(selectedColumn / 3)));

        return {
          index,
          value: value === 0 ? null : value,
          given: game.clues[index],
          notes: game.notes[index],
          selected: selected === index,
          related,
          sameColor:
            game.selectedColor !== null &&
            value === game.selectedColor &&
            value !== 0,
          conflict: conflicts.has(index),
        };
      }),
    [
      conflicts,
      game.board,
      game.clues,
      game.notes,
      game.selectedCell,
      game.selectedColor,
    ],
  );

  const onCellSelect = useCallback((index: number) => {
    setGame((current) => {
      if (current.paused || current.complete || index < 0 || index > 80) {
        return current;
      }
      if (current.clues[index]) {
        return {
          ...current,
          selectedCell: index,
          statusMessage: 'That color is a starting clue.',
          updatedAt: Date.now(),
        };
      }

      const next = { ...current, selectedCell: index, updatedAt: Date.now() };
      if (current.selectedColor === null) return next;

      const history = [...current.history, makeUndoFrame(current)].slice(
        -MAX_UNDO,
      );
      if (current.notesMode) {
        const notes = current.notes.map((cellNotes) => [...cellNotes]);
        const existing = notes[index].includes(current.selectedColor);
        notes[index] = existing
          ? notes[index].filter((color) => color !== current.selectedColor)
          : [...notes[index], current.selectedColor].sort((a, b) => a - b);
        return {
          ...next,
          notes,
          history,
          statusMessage: existing ? 'Color note removed.' : 'Color note added.',
        };
      }

      const board = [...current.board];
      board[index] = current.selectedColor;
      const notes = current.notes.map((cellNotes) => [...cellNotes]);
      notes[index] = [];
      const conflict = !isPlacementValid(board, index, current.selectedColor);
      return {
        ...next,
        board,
        notes,
        history,
        statusMessage: conflict
          ? 'That color appears elsewhere in this row, column, or block.'
          : 'Color placed.',
      };
    });
  }, []);

  const onColorSelect = useCallback((colorId: number) => {
    if (!PALETTE.some((color) => color.id === colorId)) return;
    setGame((current) =>
      current.paused || current.complete
        ? current
        : {
            ...current,
            selectedColor: colorId,
            statusMessage: `${PALETTE.find((color) => color.id === colorId)?.name ?? 'Color'} selected. Choose an empty square.`,
            updatedAt: Date.now(),
          },
    );
  }, []);

  const onToggleNotes = useCallback(() => {
    setGame((current) =>
      current.paused || current.complete
        ? current
        : {
            ...current,
            notesMode: !current.notesMode,
            statusMessage: current.notesMode
              ? 'Notes mode off.'
              : 'Notes mode on. Choose a color and an empty square.',
            updatedAt: Date.now(),
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
        current.clues[index] ||
        (current.board[index] === 0 && current.notes[index].length === 0)
      ) {
        return current;
      }
      const notes = current.notes.map((cellNotes) => [...cellNotes]);
      notes[index] = [];
      const board = [...current.board];
      board[index] = 0;
      return {
        ...current,
        board,
        notes,
        history: [...current.history, makeUndoFrame(current)].slice(-MAX_UNDO),
        statusMessage: 'Square cleared.',
        updatedAt: Date.now(),
      };
    });
  }, []);

  const onUndo = useCallback(() => {
    setGame((current) => {
      if (current.paused || current.complete || current.history.length === 0) {
        return current;
      }
      const history = [...current.history];
      const previous = history.pop()!;
      return {
        ...current,
        board: previous.board,
        notes: previous.notes,
        history,
        statusMessage: 'Last move undone.',
        updatedAt: Date.now(),
      };
    });
  }, []);

  const onHint = useCallback(() => {
    setGame((current) =>
      current.paused || current.complete
        ? current
        : {
            ...current,
            statusMessage:
              'Paid hints are not available until checkout is connected.',
            updatedAt: Date.now(),
          },
    );
  }, []);

  const onPause = useCallback(() => {
    setGame((current) =>
      current.complete
        ? current
        : {
            ...current,
            paused: true,
            statusMessage: 'Game paused.',
            updatedAt: Date.now(),
          },
    );
  }, []);

  const onResume = useCallback(() => {
    setGame((current) => ({
      ...current,
      paused: false,
      statusMessage: 'Game resumed.',
      updatedAt: Date.now(),
    }));
  }, []);

  const onNewGame = useCallback((difficulty: Difficulty) => {
    setGame((current) =>
      newGame(difficulty, false, current.theme, current.completedGames),
    );
  }, []);

  const onDailyChallenge = useCallback(() => {
    setGame((current) =>
      newGame('medium', true, current.theme, current.completedGames),
    );
  }, []);

  const onThemeChange = useCallback((theme: Theme) => {
    setGame((current) => {
      const requiredWins = THEME_UNLOCKS[theme] ?? 0;
      if (
        theme !== 'classic' &&
        current.completedGames < requiredWins
      ) {
        return {
          ...current,
          statusMessage: `Solve ${requiredWins} puzzles to unlock the ${theme} palette.`,
          updatedAt: Date.now(),
        };
      }
      return { ...current, theme, updatedAt: Date.now() };
    });
  }, []);

  useEffect(() => {
    if (!game.complete || !game.dailySeed) return;
    try {
      const completed = JSON.parse(
        window.localStorage.getItem(DAILY_COMPLETIONS_KEY) ?? '[]',
      ) as string[];
      if (!completed.includes(game.dailySeed)) {
        window.localStorage.setItem(
          DAILY_COMPLETIONS_KEY,
          JSON.stringify([...completed, game.dailySeed]),
        );
      }
    } catch {
      window.localStorage.setItem(
        DAILY_COMPLETIONS_KEY,
        JSON.stringify([game.dailySeed]),
      );
    }
  }, [game.complete, game.dailySeed]);

  useEffect(() => {
    if (game.complete || game.paused) return;
    const isSolved =
      game.board.every((value) => value !== 0) &&
      conflicts.size === 0 &&
      game.board.every((value, index) => value === game.solution[index]);
    if (isSolved) {
      setGame((current) => ({
        ...current,
        complete: true,
        completedGames: current.completedGames + 1,
        statusMessage: 'Puzzle solved. Great work!',
        updatedAt: Date.now(),
      }));
    }
  }, [conflicts, game.board, game.complete, game.paused, game.solution]);

  return {
    cells,
    palette: palette satisfies PaletteColor[],
    difficulty: game.difficulty,
    theme: game.theme,
    daily: game.daily,
    elapsed: formatTime(game.elapsedSeconds),
    notesMode: game.notesMode,
    paused: game.paused,
    complete: game.complete,
    selectedColor: game.selectedColor,
    statusMessage: game.statusMessage,
    hintPrice: '$0.25',
    hintAvailable: false,
    unlockedThemes,
    completedGames: game.completedGames,
    onCellSelect,
    onColorSelect,
    onToggleNotes,
    onClear,
    onUndo,
    onHint,
    onPause,
    onResume,
    onNewGame,
    onDailyChallenge,
    onThemeChange,
    availableDifficulties: DIFFICULTIES,
    canUndo: game.history.length > 0,
  };
}

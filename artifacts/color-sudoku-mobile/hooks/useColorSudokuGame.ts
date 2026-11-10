import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { completeRankedGame, startRankedGame } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

import { paletteByTheme, type GameTheme } from '@/constants/colors';
import { createDailySeed, difficulties, isPlacementValid, modeFor, solvePuzzle, type Difficulty, type BoardSize } from '@/lib/sudoku';
import { buildGame, conflictIndexes, detachOnlineRankings, parseSavedGame, snapshot, type SavedGame, type Screen } from '@/lib/game-state';
import { deleteOnlineRankingProfile, ensurePlayer, onlineRankingsBlocked, rankingPrivacy } from '@/lib/rankings';

const STORAGE_KEY = 'color-sudoku-mobile.save.v1';
const THEME_UNLOCKS: Partial<Record<GameTheme, number>> = { pastel: 1, neon: 3, dark: 5 };
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const editable = (game: SavedGame) => game.screen === 'game' && !game.paused && !game.complete;

export function useColorSudokuGame() {
  const [game, setGame] = useState<SavedGame>(() => ({
    ...buildGame('very-easy', 'classic', null, 0, 9), screen: 'home', paused: true, hasPuzzle: false,
  }));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const writable = useRef(true);
  const writeQueue = useRef(Promise.resolve());
  const busyRef = useRef(false);
  const submission = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), rankingPrivacy()]).then(([raw, privacy]) => {
      if (active && raw) {
        const saved = parseSavedGame(raw);
        setGame(privacy === 'active' ? saved : detachOnlineRankings(saved));
      }
    }).catch((err) => {
      writable.current = false;
      if (active) setSaveError(err instanceof Error ? err.message : 'Could not read your saved puzzle. Storage has not been overwritten.');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || !writable.current) return;
    const data = JSON.stringify(game);
    // Serialize writes: an older, slower save can never overwrite a newer move.
    writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(STORAGE_KEY, data))
      .then(() => setSaveError(''))
      .catch(() => setSaveError('Could not save on this device. Keep the app open and free some storage.'));
  }, [game, ready]);

  useEffect(() => {
    if (!ready || !editable(game)) return;
    const timer = setInterval(() => setGame((current) => editable(current)
      ? { ...current, elapsedSeconds: current.elapsedSeconds + 1 } : current), 1000);
    return () => clearInterval(timer);
  }, [ready, game.paused, game.complete, game.screen]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setGame((current) => current.screen === 'game' && !current.complete
        ? { ...current, paused: true } : current);
    });
    return () => listener.remove();
  }, []);

  const submitResult = useCallback(async (current: SavedGame) => {
    if (!current.pendingResults.length || submission.current || onlineRankingsBlocked()) return;
    submission.current = true;
    try {
      await ensurePlayer();
      for (const result of current.pendingResults) {
        const id = result.id;
        setGame((value) => value.rankedId === id ? { ...value, rankingStatus: 'Checking your result online…' } : value);
        try {
          const receipt = await completeRankedGame(id, { board: result.board });
          setGame((value) => ({
            ...value, pendingResults: value.pendingResults.filter((item) => item.id !== id),
            ...(value.rankedId === id ? {
              rankingAccepted: true,
              rankingStatus: `Result verified. Ranked time ${formatTime(Math.floor(receipt.elapsedMs / 1000))} (includes pauses).`,
            } : {}),
          }));
        } catch (err) {
          if ([404, 410].includes((err as { status?: number }).status ?? 0)) {
            setGame((value) => ({
              ...value, pendingResults: value.pendingResults.filter((item) => item.id !== id),
              ...(value.rankedId === id ? { rankingStatus: 'This ranked puzzle expired or was cleared at the monthly reset. Your local completion is saved.' } : {}),
            }));
          } else throw err;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/leaderboards'] });
    } catch {
      setGame((value) => ({ ...value, rankingStatus: 'Could not submit your result. It is saved for retry.' }));
    } finally { submission.current = false; }
  }, [queryClient]);
  const pendingIds = game.pendingResults.map((result) => result.id).join(',');
  useEffect(() => {
    if (ready && pendingIds) void submitResult(game);
    // Only submit on completion/load, not on status changes (errors require an explicit retry).
  }, [ready, pendingIds, submitResult]);

  const onColorSelect = useCallback((color: number) => setGame((current) =>
    !editable(current) || color < 1 || color > current.size ? current : {
      ...current, selectedColor: color,
      status: `${paletteByTheme[current.theme][color - 1].name} selected. Choose an empty square.`,
    }), []);
  const onCellSelect = useCallback((index: number) => setGame((current) => {
    if (!editable(current) || !Number.isInteger(index) || index < 0 || index >= current.board.length) return current;
    const selected = { ...current, selectedCell: index };
    if (current.clues[index]) return { ...selected, status: 'That color is a starting clue.' };
    const color = current.selectedColor;
    if (color === null) return selected;
    const history = [...current.history, snapshot(current)].slice(-40);
    const notes = current.notes.map((cell) => [...cell]);
    if (current.notesMode) {
      if (current.board[index]) return { ...selected, status: 'Pencil marks go in empty squares.' };
      notes[index] = notes[index].includes(color) ? notes[index].filter((n) => n !== color) : [...notes[index], color].sort();
      return { ...selected, notes, history, status: 'Pencil mark updated.' };
    }
    const board = [...current.board];
    board[index] = color; notes[index] = [];
    const complete = board.every((value, i) => value === current.solution[i]);
    return {
      ...selected, board, notes, history, complete,
      completedGames: current.completedGames + (complete ? 1 : 0),
      pendingResults: complete && current.rankedId
        ? [...current.pendingResults, { id: current.rankedId, board: [...board] }] : current.pendingResults,
      status: complete ? 'Puzzle solved. Great work!' : isPlacementValid(board, index, color, current.size)
        ? 'Color placed.' : 'That color repeats in this row, column, or block.',
    };
  }), []);
  const onToggleNotes = useCallback(() => setGame((current) => !editable(current) ? current
    : { ...current, notesMode: !current.notesMode }), []);
  const onClear = useCallback(() => setGame((current) => {
    const index = current.selectedCell;
    if (!editable(current) || index === null || current.clues[index]) return current;
    const board = [...current.board], notes = current.notes.map((cell) => [...cell]);
    board[index] = 0; notes[index] = [];
    return { ...current, board, notes, history: [...current.history, snapshot(current)].slice(-40), status: 'Square cleared.' };
  }), []);
  const onUndo = useCallback(() => setGame((current) => {
    if (!editable(current) || !current.history.length) return current;
    const history = [...current.history], last = history.pop()!;
    return { ...current, board: last.board, notes: last.notes, history, status: 'Last move undone.' };
  }), []);
  const onPause = useCallback(() => setGame((current) => ({ ...current, paused: true })), []);
  const onResume = useCallback(() => setGame((current) => !current.hasPuzzle ? current
    : { ...current, screen: 'game', paused: false }), []);
  const onNavigate = useCallback((screen: Screen) => {
    setError('');
    setGame((current) => ({ ...current, screen, paused: screen !== 'game' || current.paused }));
  }, []);
  const onHome = useCallback(() => onNavigate('home'), [onNavigate]);
  const onNewGame = useCallback((difficulty: Difficulty, size?: BoardSize) => {
    if (!ready || busyRef.current) return;
    setError('');
    setGame((current) => ({ ...buildGame(difficulty, current.theme, null, current.completedGames, size ?? current.size),
      pendingResults: current.pendingResults }));
  }, [ready]);
  const onDailyChallenge = useCallback((size?: BoardSize) => {
    if (!ready || busyRef.current) return;
    setError('');
    setGame((current) => ({ ...buildGame('medium', current.theme, createDailySeed(), current.completedGames, size ?? current.size),
      pendingResults: current.pendingResults }));
  }, [ready]);
  const onStartRanked = useCallback(async (difficulty: Difficulty, size: BoardSize) => {
    if (!ready || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      await ensurePlayer();
      const issued = await startRankedGame({ size, difficulty });
      const solution = solvePuzzle(issued.puzzle, size);
      if (!solution) throw new Error('Server puzzle could not be loaded.');
      setGame((current) => ({
        ...buildGame(difficulty, current.theme, null, current.completedGames, size),
        board: issued.puzzle, solution, clues: issued.puzzle.map(Boolean),
        pendingResults: current.pendingResults,
        rankedId: issued.id, status: 'Ranked play. Online time includes pauses and time away.',
      }));
    } catch (err) {
      setError((err as { status?: number }).status === 429
        ? 'Ranked play limit reached. Try practice or come back later.'
        : onlineRankingsBlocked() ? 'Online rankings are off. Open Add-ons → Privacy to enable them or finish deletion.'
        : 'Could not start ranked play. Your saved puzzle is unchanged. Check your connection and retry.');
    } finally { busyRef.current = false; setBusy(false); }
  }, [ready]);
  const onDeleteRankingData = useCallback(async () => {
    if (!ready || busyRef.current || submission.current || !writable.current) {
      throw new Error('Please wait for saving or online play to finish, then try again.');
    }
    busyRef.current = true; setBusy(true);
    try {
      await deleteOnlineRankingProfile();
      setGame((current) => detachOnlineRankings(current));
      // Remove cached personal standings before another profile can be enabled.
      await queryClient.cancelQueries({ queryKey: ['/api/leaderboards'] });
      queryClient.removeQueries({ queryKey: ['/api/leaderboards'] });
    } finally { busyRef.current = false; setBusy(false); }
  }, [ready, queryClient]);
  const onThemeChange = useCallback((theme: GameTheme) => setGame((current) =>
    theme !== 'classic' && current.completedGames < (THEME_UNLOCKS[theme] ?? Infinity) ? current
      : { ...current, theme }), []);
  const conflicts = useMemo(() => conflictIndexes(game.board, game.size), [game.board, game.size]);
  const unlockedThemes = useMemo(() => (['classic', 'pastel', 'neon', 'dark'] as GameTheme[])
    .filter((theme) => game.completedGames >= (THEME_UNLOCKS[theme] ?? 0)), [game.completedGames]);
  return {
    ...game, ready, busy, error, saveError, hasSavedPuzzle: game.hasPuzzle && !game.complete,
    ranked: !!game.rankedId, ...modeFor(game.size),
    // modeFor also returns size, but game.size is the authoritative saved value.
    palette: paletteByTheme[game.theme].slice(0, game.size), conflicts, unlockedThemes,
    elapsed: formatTime(game.elapsedSeconds), canUndo: game.history.length > 0,
    hintPrice: '$0.25', hintAvailable: false, difficultyOptions: difficulties,
    onColorSelect, onCellSelect, onToggleNotes, onClear, onUndo, onPause, onResume, onHome,
    onNavigate, onNewGame, onDailyChallenge, onStartRanked, onThemeChange, onDeleteRankingData,
    onHint: () => undefined,
    onRetryRanking: () => void submitResult(game),
  };
}

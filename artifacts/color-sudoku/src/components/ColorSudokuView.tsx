import {
  type DragEvent as ReactDragEvent,
  useEffect,
  useRef,
} from 'react';
import {
  ArrowDownToLine,
  Check,
  CircleHelp,
  Clock3,
  Eraser,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  SwatchBook,
  Target,
  Trophy,
} from 'lucide-react';

export type Difficulty = 'very-easy' | 'easy' | 'medium' | 'hard' | 'expert';
export type Theme = 'classic' | 'pastel' | 'neon' | 'dark';

export type PaletteItem = {
  id: number;
  name: string;
  hex: string;
};

export type CellView = {
  index: number;
  value: number | null;
  given: boolean;
  notes: number[];
  selected: boolean;
  related: boolean;
  sameColor: boolean;
  conflict: boolean;
};

export type ColorSudokuViewProps = {
  offlineEdition?: boolean;
  onHome?(): void;
  onShowTutorial?(): void;
  cells: CellView[];
  palette: PaletteItem[];
  difficulty: Difficulty;
  theme: Theme;
  daily: boolean;
  elapsed: string;
  notesMode: boolean;
  paused: boolean;
  complete: boolean;
  hintPrice: string | null;
  hintAvailable: boolean;
  selectedColor: number | null;
  unlockedThemes: Theme[];
  completedGames: number;
  statusMessage: string;
  onCellSelect(index: number): void;
  onColorSelect(id: number): void;
  onToggleNotes(): void;
  onClear(): void;
  onUndo(): void;
  onHint(): void;
  onPause(): void;
  onResume(): void;
  onNewGame(difficulty: Difficulty): void;
  onDailyChallenge(): void;
  onThemeChange(theme: Theme): void;
};

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'very-easy', label: 'Very Easy' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'expert', label: 'Expert' },
];

const THEMES: { value: Theme; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'neon', label: 'Neon' },
  { value: 'dark', label: 'Dark' },
];

const THEME_UNLOCKS: Partial<Record<Theme, number>> = {
  pastel: 1,
  neon: 3,
  dark: 5,
};

function difficultyName(value: Difficulty) {
  return DIFFICULTIES.find((item) => item.value === value)?.label ?? 'Medium';
}

function getStatusKind(message: string) {
  if (/error|invalid|conflict|cannot|can't|not available/i.test(message)) return 'error';
  if (/complete|great|correct|saved|nice|well done/i.test(message)) return 'success';
  return 'neutral';
}

export function ColorSudokuView({
  offlineEdition = false,
  onHome,
  onShowTutorial,
  cells,
  palette,
  difficulty,
  theme,
  daily,
  elapsed,
  notesMode,
  paused,
  complete,
  hintPrice,
  hintAvailable,
  selectedColor,
  unlockedThemes,
  completedGames,
  statusMessage,
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
}: ColorSudokuViewProps) {
  const touchDragColor = useRef<number | null>(null);
  const colorForId = (id: number) => palette.find((item) => item.id === id);
  const boardReady = cells.length === 81;
  const status = statusMessage.trim() || (!hintAvailable
    ? 'Paid hints are unavailable until checkout is connected.'
    : boardReady
    ? 'Choose a cell, then choose a color. Matching colors and related spaces are highlighted.'
    : 'The puzzle is getting ready. Start a new game to load a color board.');
  const statusKind = getStatusKind(status);
  const nextTheme = THEMES.find((item) => !unlockedThemes.includes(item.value));
  const nextUnlock = nextTheme ? THEME_UNLOCKS[nextTheme.value] : undefined;

  const chooseColor = (id: number) => {
    onColorSelect(id);
  };

  useEffect(() => {
    const finishTouchDrag = (event: PointerEvent) => {
      if (touchDragColor.current === null) return;
      touchDragColor.current = null;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-cell-index]');
      const index = Number(target?.dataset.cellIndex);
      if (target && Number.isInteger(index)) onCellSelect(index);
    };
    const cancelTouchDrag = () => {
      touchDragColor.current = null;
    };
    window.addEventListener('pointerup', finishTouchDrag);
    window.addEventListener('pointercancel', cancelTouchDrag);
    return () => {
      window.removeEventListener('pointerup', finishTouchDrag);
      window.removeEventListener('pointercancel', cancelTouchDrag);
    };
  }, [onCellSelect]);

  const handleDrop = (event: ReactDragEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    const rawId = event.dataTransfer.getData('text/color-sudoku-id');
    const id = Number(rawId);
    if (!Number.isNaN(id) && palette.some((color) => color.id === id)) {
      chooseColor(id);
      onCellSelect(index);
    }
  };

  const renderCellContents = (cell: CellView) => {
    if (cell.value !== null) {
      const color = colorForId(cell.value);
      return color ? (
        <span
          className="cell-color"
          style={{ backgroundColor: color.hex }}
          aria-hidden="true"
          title={color.name}
        />
      ) : (
        <span className="cell-color" aria-hidden="true" />
      );
    }
    if (!cell.notes?.length) return null;
    return (
      <span className="cell-notes" aria-hidden="true">
        {palette.slice(0, 9).map((color) => (
          <span
            key={color.id}
            className="note-dot"
            style={{
              backgroundColor: color.hex,
              opacity: cell.notes.includes(color.id) ? 0.95 : 0,
            }}
            title={cell.notes.includes(color.id) ? color.name : undefined}
          />
        ))}
      </span>
    );
  };

  return (
    <main className="sudoku-shell" data-theme={theme}>
      <div className="game-wrap">
        <header className="game-header">
          <div className="brand-lockup" aria-label="Palette Play">
            <span className="brand-mark" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
            </span>
            <div>
              <h1 className="brand-title">Palette Play</h1>
              <p className="brand-caption">A little logic, a lot of color</p>
            </div>
          </div>
          <div className="header-right">
            <span className="header-badge">
              <SwatchBook size={14} aria-hidden="true" />
              No numbers. Just colors.
            </span>
            <button
              className="header-badge"
              type="button"
              onClick={paused ? onResume : onPause}
              data-testid="button-pause"
              aria-label={paused ? 'Resume game' : 'Pause game'}
            >
              {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
              {paused ? 'Resume' : 'Pause'}
            </button>
            {onShowTutorial && <button className="header-badge tutorial-help" type="button" onClick={onShowTutorial} data-testid="button-how-to-play">
              <CircleHelp size={14} aria-hidden="true" /> How to play
            </button>}
          </div>
        </header>

        {onHome && <button className="header-badge" type="button" onClick={onHome} data-testid="button-home">
          Home
        </button>}

        <div className="game-layout">
          <section className="play-column" aria-label="Puzzle board">
            <div className="intro-row">
              <div>
                <div className="eyebrow">
                  {daily ? <Sparkles size={13} aria-hidden="true" /> : <Target size={13} aria-hidden="true" />}
                  {daily ? 'Today’s color challenge' : `${difficultyName(difficulty)} puzzle`}
                </div>
                <h2 className="game-heading">{daily ? 'A fresh pattern awaits' : 'Find the color rhythm'}</h2>
                <p className="game-subtitle">One of each color in every row, column, and square.</p>
              </div>
              <div className="timer-pill" aria-label={`Elapsed time ${elapsed}`}>
                <Clock3 size={15} aria-hidden="true" />
                <span data-testid="text-elapsed">{elapsed || '00:00'}</span>
              </div>
            </div>

            {boardReady ? (
              <div className="board-card">
                <div className="board-grid" role="grid" aria-label="Palette Play board">
                  {cells.map((cell) => {
                    const valueColor = cell.value === null ? undefined : colorForId(cell.value);
                    const notesText = cell.notes
                      .map((id) => colorForId(id)?.name)
                      .filter(Boolean)
                      .join(', ');
                    const cellLabel = [
                      `Cell ${cell.index + 1}`,
                      valueColor ? `${valueColor.name} color` : 'empty',
                      cell.given ? 'given' : '',
                      notesText ? `pencil marks: ${notesText}` : '',
                      cell.conflict ? 'conflict' : '',
                    ].filter(Boolean).join(', ');
                    return (
                      <button
                        key={cell.index}
                        type="button"
                        role="gridcell"
                        aria-label={cellLabel}
                        aria-selected={cell.selected}
                        className={[
                          'sudoku-cell',
                          cell.selected ? 'is-selected' : '',
                          cell.related ? 'is-related' : '',
                          cell.sameColor ? 'is-same' : '',
                          cell.conflict ? 'is-conflict' : '',
                          cell.given ? 'is-given' : '',
                        ].filter(Boolean).join(' ')}
                        data-testid={`cell-${cell.index}`}
                        data-cell-index={cell.index}
                        onClick={() => onCellSelect(cell.index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, cell.index)}
                      >
                        {renderCellContents(cell)}
                      </button>
                    );
                  })}
                </div>
                <div className="board-foot">
                  <span><Target size={13} aria-hidden="true" /> Same colors glow together</span>
                  <span><ArrowDownToLine size={13} aria-hidden="true" /> Drop a color to place</span>
                </div>
                {paused && !complete && (
                  <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-heading">
                    <div className="overlay-card">
                      <span className="overlay-icon"><Pause size={23} aria-hidden="true" /></span>
                      <h2 id="pause-heading">Take a breather</h2>
                      <p>Your puzzle is right here when you’re ready.</p>
                      <button className="primary-button" type="button" onClick={onResume} data-testid="button-resume">
                        <Play size={15} aria-hidden="true" /> Resume puzzle
                      </button>
                      {onHome && <button className="header-badge" type="button" onClick={onHome} data-testid="button-pause-home">
                        Save &amp; return home
                      </button>}
                    </div>
                  </div>
                )}
                {complete && (
                  <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="complete-heading">
                    <div className="overlay-card success-card">
                      <span className="overlay-icon"><Trophy size={25} aria-hidden="true" /></span>
                      <h2 id="complete-heading">Beautifully solved.</h2>
                      <p className="success-time">Puzzle time: {elapsed || '00:00'}</p>
                      {!offlineEdition && <aside className="reserved-ad" aria-label="Reserved advertisement placement">
                        <strong>Reserved ad placement</strong>
                        <span>This space is intentionally empty. No advertisement is shown.</span>
                      </aside>}
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => onNewGame(difficulty)}
                        data-testid="button-new-game-complete"
                      >
                        <Sparkles size={15} aria-hidden="true" /> Play another
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-card" data-testid="status-board-unavailable">
                <CircleHelp size={24} aria-hidden="true" />
                <h2>Board not ready yet</h2>
                <p>When a puzzle is loaded, its color grid will appear here.</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onNewGame(difficulty)}
                  data-testid="button-start-game"
                >
                  <Play size={15} aria-hidden="true" /> Start a puzzle
                </button>
              </div>
            )}
          </section>

          <aside className="side-panel" aria-label="Puzzle controls">
            <section className="panel-card">
              <div className="panel-topline">
                <div>
                  <h2 className="panel-title">Color tray</h2>
                  <p className="panel-kicker">Tap a swatch or drag it to a space.</p>
                </div>
                <span className="palette-count">Nine colors</span>
              </div>
              {palette.length ? (
                <div className="palette-grid">
                  {palette.slice(0, 9).map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      className={`palette-color ${selectedColor === color.id ? 'is-active' : ''}`}
                      onClick={() => chooseColor(color.id)}
                      onPointerDown={(event) => {
                        if (event.pointerType !== 'mouse') {
                          event.preventDefault();
                          touchDragColor.current = color.id;
                          onColorSelect(color.id);
                        }
                      }}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/color-sudoku-id', String(color.id));
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      data-testid={`color-${color.id}`}
                      aria-label={`Choose ${color.name}`}
                      aria-pressed={selectedColor === color.id}
                      title={`${color.name} — tap to choose or drag to a space`}
                    >
                      <span className="palette-swatch" style={{ backgroundColor: color.hex }} aria-hidden="true" />
                      <span className="palette-name">{color.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-card" data-testid="status-palette-unavailable">
                  <p>Color choices will appear here when the palette is ready.</p>
                </div>
              )}
              <p className="palette-hint"><Lightbulb size={13} aria-hidden="true" /> The same color lights up wherever it already appears.</p>
            </section>

            <section className="panel-card">
              <div className="panel-topline">
                <div>
                  <h2 className="panel-title">Make a move</h2>
                  <p className="panel-kicker">Little tools for a big-brain moment.</p>
                </div>
              </div>
              <div className="tool-row">
                <button type="button" className="tool-button" onClick={onUndo} data-testid="button-undo">
                  <RotateCcw size={17} aria-hidden="true" /><span>Undo</span>
                </button>
                <button type="button" className="tool-button" onClick={onClear} data-testid="button-clear">
                  <Eraser size={17} aria-hidden="true" /><span>Clear</span>
                </button>
                <button
                  type="button"
                  className="tool-button"
                  onClick={() => {
                    if (hintAvailable && hintPrice) onHint();
                  }}
                  disabled={!hintAvailable || !hintPrice}
                  data-testid="button-hint"
                  aria-label={
                    offlineEdition ? 'Reveal a correct color for free' : hintAvailable && hintPrice
                      ? `Purchase a hint for ${hintPrice}`
                      : `Paid hint for ${hintPrice ?? 'a set price'} is unavailable`
                  }
                  title={
                    offlineEdition ? 'Free hint — no payment required' : hintAvailable && hintPrice
                      ? `Hint price: ${hintPrice}`
                      : 'Checkout setup is pending; no charge can be made yet.'
                  }
                >
                  <Lightbulb size={17} aria-hidden="true" />
                  <span>{offlineEdition ? 'Free hint' : hintPrice ? `Hint · ${hintPrice}` : 'Hints unavailable'}</span>
                </button>
              </div>
              <button
                type="button"
                className={`notes-button ${notesMode ? 'is-on' : ''}`}
                onClick={onToggleNotes}
                data-testid="button-pencil-marks"
                aria-pressed={notesMode}
              >
                {notesMode ? <Check size={16} aria-hidden="true" /> : <CircleHelp size={16} aria-hidden="true" />}
                <span>{notesMode ? 'Pencil marks on' : 'Add pencil marks'}</span>
              </button>
            </section>

            <section className="panel-card">
              <div className="panel-topline">
                <div>
                  <h2 className="panel-title">Your table</h2>
                  <p className="panel-kicker">Choose a puzzle or set the mood.</p>
                </div>
              </div>
              <div className="difficulty-select">
                <label className="difficulty-label" htmlFor="difficulty-select">Difficulty</label>
                <div className="difficulty-wrap">
                  <select
                    id="difficulty-select"
                    value={difficulty}
                    onChange={(event) => onNewGame(event.target.value as Difficulty)}
                    data-testid="select-difficulty"
                    aria-label="Choose difficulty"
                  >
                    {DIFFICULTIES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="theme-row" role="group" aria-label="Color theme" style={{ marginTop: 13 }}>
                {THEMES.map((item) => {
                  const isUnlocked = unlockedThemes.includes(item.value);
                  const requiredWins = THEME_UNLOCKS[item.value];
                  const lockMessage = requiredWins
                    ? `Solve ${requiredWins} puzzles to unlock ${item.label}.`
                    : `${item.label} palette is locked.`;
                  return (
                  <button
                    key={item.value}
                    type="button"
                    className={`theme-chip ${theme === item.value ? 'is-active' : ''}`}
                    onClick={() => {
                      if (isUnlocked) onThemeChange(item.value);
                    }}
                    disabled={!isUnlocked}
                    data-testid={`theme-${item.value}`}
                    aria-pressed={theme === item.value}
                    aria-label={isUnlocked ? `${item.label} theme` : lockMessage}
                    title={isUnlocked ? item.label : lockMessage}
                  >
                    <span className={`theme-dot ${item.value}`} aria-hidden="true" />
                    {item.label}
                  </button>
                  );
                })}
              </div>
              <p className="progress-copy" data-testid="text-theme-progress">
                {completedGames} {completedGames === 1 ? 'puzzle' : 'puzzles'} solved
                {nextTheme && nextUnlock
                  ? ` · ${nextTheme.label} unlocks at ${nextUnlock}`
                  : ' · Every palette unlocked'}
              </p>
            </section>

            <section className="daily-card">
              <div className="daily-copy">
                <span className="daily-icon"><Sparkles size={17} aria-hidden="true" /></span>
                <span><strong>Daily color play</strong><small>A new pattern every day</small></span>
              </div>
              <button type="button" className="daily-button" onClick={onDailyChallenge} data-testid="button-daily-challenge">
                {daily ? 'Replay' : 'Play today'} <span aria-hidden="true">→</span>
              </button>
            </section>
            <p className="status-line" role="status" aria-live="polite" data-kind={statusKind} data-testid="status-game">
              {statusKind === 'error' ? <CircleHelp size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
              {status}
            </p>
          </aside>
        </div>

        <footer className="game-footer">
          <span className="footer-brand"><Sun size={13} aria-hidden="true" /> A cheerful challenge, at your own pace</span>
          <span className="footer-brand"><SwatchBook size={13} aria-hidden="true" /> No numbers on the board</span>
        </footer>
      </div>
    </main>
  );
}

export default ColorSudokuView;

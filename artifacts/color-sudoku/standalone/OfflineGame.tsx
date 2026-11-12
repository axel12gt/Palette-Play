import { useState } from 'react';
import { TutorialOverlay } from './TutorialOverlay';
import ColorSudokuView from '../src/components/ColorSudokuView';
import { useSudokuGame } from '../src/lib/use-sudoku-game';
import type { Difficulty } from '../src/lib/sudoku';

export default function OfflineGame() {
  const [playing, setPlaying] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('very-easy');
  const [tutorialVisible, setTutorialVisible] = useState(() => {
    try { return window.localStorage.getItem('palette-play.offline.tutorial.v1') !== 'seen'; }
    catch { return true; }
  });
  const game = useSudokuGame({ offlineEdition: true, active: playing });
  const canResume = game.hasSavedPuzzle && !game.complete;
  const closeTutorial = () => {
    setTutorialVisible(false);
    try { window.localStorage.setItem('palette-play.offline.tutorial.v1', 'seen'); } catch { /* Tutorial can still be dismissed for this session. */ }
  };
  const start = (daily = false) => {
    if (canResume && !window.confirm('Start a new puzzle? This will replace your saved puzzle.')) return;
    if (daily) game.onDailyChallenge();
    else game.onNewGame(difficulty);
    setPlaying(true);
  };

  if (playing) {
    return <><ColorSudokuView {...game} offlineEdition onShowTutorial={() => setTutorialVisible(true)} onHome={() => {
      game.onPause();
      setPlaying(false);
    }} />{tutorialVisible && <TutorialOverlay onClose={closeTutorial} />}</>;
  }

  return (
    <main className="sudoku-shell offline-home" data-theme={game.theme}>
      <section className="offline-home-card" aria-labelledby="home-title">
        <div className="brand-mark offline-home-mark" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
        </div>
        <p className="eyebrow">Your daily dose of color &amp; logic</p>
        <h1 id="home-title" className="brand-title">Palette Play</h1>
        <p>No numbers. Just one of each color in every row, column, and block.</p>
        <button type="button" className="header-badge offline-wide" onClick={() => setTutorialVisible(true)} data-testid="button-how-to-play">
          How to play
        </button>
        {canResume && <button type="button" className="primary-button offline-wide" onClick={() => {
          game.onResume();
          setPlaying(true);
        }} data-testid="button-home-resume">Resume saved puzzle · {game.elapsed}</button>}
        <fieldset className="offline-difficulties">
          <legend>Choose your difficulty</legend>
          {game.availableDifficulties.map(item => (
            <label key={item.id} className={difficulty === item.id ? 'offline-choice is-selected' : 'offline-choice'}>
              <input type="radio" name="difficulty" value={item.id} checked={difficulty === item.id}
                onChange={() => setDifficulty(item.id)} />
              {item.label}
            </label>
          ))}
        </fieldset>
        <button type="button" className="primary-button offline-wide" onClick={() => start()} data-testid="button-home-new">
          Start new puzzle
        </button>
        <button type="button" className="header-badge offline-wide" onClick={() => start(true)} data-testid="button-home-daily">
          Play today’s challenge
        </button>
        <p className="offline-footnote">9 × 9 puzzles · Free hints · No ads · Works offline</p>
        <p className="offline-footnote">{game.completedGames} puzzles completed</p>
        {game.statusMessage.includes('storage is unavailable') && <p role="alert">{game.statusMessage}</p>}
      </section>
      {tutorialVisible && <TutorialOverlay onClose={closeTutorial} />}
    </main>
  );
}

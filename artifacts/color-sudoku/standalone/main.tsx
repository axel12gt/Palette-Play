import { createRoot } from 'react-dom/client';
import ColorSudokuView from '../src/components/ColorSudokuView';
import { useSudokuGame } from '../src/lib/use-sudoku-game';
import '../src/index.css';

function OfflineGame() {
  const game = useSudokuGame({ offlineEdition: true });
  return <ColorSudokuView {...game} offlineEdition />;
}

createRoot(document.getElementById('root')!).render(<OfflineGame />);

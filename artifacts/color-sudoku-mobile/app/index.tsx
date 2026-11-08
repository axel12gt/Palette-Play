import ColorSudokuScreen from '@/components/ColorSudokuScreen';
import { useColorSudokuGame } from '@/hooks/useColorSudokuGame';

export default function HomeScreen() {
  const game = useColorSudokuGame();
  return <ColorSudokuScreen game={game} />;
}

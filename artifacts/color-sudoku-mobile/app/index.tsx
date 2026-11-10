import AddonsScreen from '@/components/AddonsScreen';
import ColorSudokuScreen from '@/components/ColorSudokuScreen';
import HomeScreen from '@/components/HomeScreen';
import LeaderboardScreen from '@/components/LeaderboardScreen';
import { useColorSudokuGame } from '@/hooks/useColorSudokuGame';
import { ActivityIndicator, Text, View } from 'react-native';
import { useScene } from '@/components/Scene';

export default function Index() {
  const game = useColorSudokuGame();
  const scene = useScene(game.theme);
  if (!game.ready) return (
    <View style={{ flex: 1, backgroundColor: scene.background, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      <ActivityIndicator size="large" color={scene.primary} />
      <Text style={{ color: scene.text }}>Loading your saved puzzle…</Text>
    </View>
  );
  switch (game.screen) {
    case 'game':
      return <ColorSudokuScreen game={game} />;
    case 'addons':
      return <AddonsScreen game={game} />;
    case 'leaderboards':
      return <LeaderboardScreen game={game} />;
    default:
      return <HomeScreen game={game} />;
  }
}

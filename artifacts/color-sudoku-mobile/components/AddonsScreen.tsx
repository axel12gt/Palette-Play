import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { boardModes } from '@/lib/sudoku';
import RankingPrivacyControls from '@/components/RankingPrivacyControls';
import type { useColorSudokuGame } from '@/hooks/useColorSudokuGame';
import { AdBanner, FONT, THEME_OPTIONS, TopBar, useInsets, useScene } from '@/components/Scene';

type Game = ReturnType<typeof useColorSudokuGame>;
type IconName = ComponentProps<typeof Ionicons>['name'];

export default function AddonsScreen({ game }: { game: Game }) {
  const insets = useInsets();
  const scene = useScene(game.theme);

  const Row = ({
    icon,
    title,
    detail,
    badge,
    tone,
    testID,
  }: {
    icon: IconName;
    title: string;
    detail: string;
    badge: string;
    tone: 'free' | 'earned' | 'locked' | 'pending';
    testID: string;
  }) => {
    const badgeColor =
      tone === 'free' || tone === 'earned' ? scene.primary : tone === 'pending' ? scene.accent : scene.muted;
    return (
      <View
        testID={testID}
        accessibilityLabel={`${title}. ${detail}. ${badge}`}
        style={[styles.row, { borderColor: scene.border, opacity: tone === 'pending' ? 0.75 : 1 }]}
      >
        <View style={[styles.rowIcon, { backgroundColor: `${badgeColor}1c` }]}>
          <Ionicons name={icon} size={18} color={badgeColor} />
        </View>
        <View style={styles.flex}>
          <Text style={{ color: scene.text, fontFamily: FONT.semi, fontSize: 14 }}>{title}</Text>
          <Text style={{ color: scene.muted, fontFamily: FONT.regular, fontSize: 11, lineHeight: 16 }}>{detail}</Text>
        </View>
        <View style={[styles.badge, { borderColor: badgeColor }]}>
          <Text style={{ color: badgeColor, fontFamily: FONT.bold, fontSize: 10 }}>{badge}</Text>
        </View>
      </View>
    );
  };

  const Section = ({ title, note, children }: { title: string; note: string; children: ReactNode }) => (
    <View style={[styles.card, { backgroundColor: scene.card, borderColor: scene.border }]}>
      <Text style={{ color: scene.text, fontFamily: FONT.display, fontSize: 19 }}>{title}</Text>
      <Text style={{ color: scene.muted, fontFamily: FONT.regular, fontSize: 12, marginBottom: 4 }}>{note}</Text>
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: scene.background }]}>
      <StatusBar style={game.theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
      >
        <AdBanner scene={scene} />
        <TopBar scene={scene} title="Add-ons" onBack={() => game.onNavigate('home')} />
        <RankingPrivacyControls scene={scene} busy={game.busy} onDelete={game.onDeleteRankingData} />

        <Section title="Board modes" note="Every board size is free to play.">
          {boardModes.map((m) => (
            <Row
              key={m.size}
              icon="grid-outline"
              title={m.label}
              detail={`${m.description}, ${m.size} colors`}
              badge="FREE"
              tone="free"
              testID={`addon-board-${m.size}`}
            />
          ))}
        </Section>

        <Section title="Color themes" note={`Earned by solving puzzles, never sold. You have ${game.completedGames} wins.`}>
          {THEME_OPTIONS.map((t) => {
            const unlocked = game.unlockedThemes.includes(t.id);
            return (
              <Row
                key={t.id}
                icon={unlocked ? 'color-palette-outline' : 'lock-closed-outline'}
                title={t.label}
                detail={t.wins === 0 ? 'Included' : `Unlocks at ${t.wins} wins`}
                badge={unlocked ? 'UNLOCKED' : `${Math.max(0, t.wins - game.completedGames)} TO GO`}
                tone={unlocked ? 'earned' : 'locked'}
                testID={`addon-theme-${t.id}`}
              />
            );
          })}
        </Section>

        <Section title="Planned purchases" note="Not available yet. Awaiting Google Play setup, so nothing can be bought or restored.">
          <Row
            icon="bulb-outline"
            title="Hints"
            detail="$0.25 each, reveals one correct color"
            badge="PLANNED"
            tone="pending"
            testID="addon-hints"
          />
          <Row
            icon="remove-circle-outline"
            title="Remove all ads"
            detail="$5 one-time"
            badge="PLANNED"
            tone="pending"
            testID="addon-remove-ads"
          />
        </Section>

        <Section title="Ads" note="Ad spaces are reserved but empty. Ads are awaiting AdMob setup.">
          <Row
            icon="albums-outline"
            title="Banner and completion spots"
            detail="No ad is shown or simulated"
            badge="AWAITING"
            tone="pending"
            testID="addon-ads"
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 0 },
  card: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
});

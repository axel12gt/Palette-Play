import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { boardModes, type BoardSize, type Difficulty } from '@/lib/sudoku';
import type { useColorSudokuGame } from '@/hooks/useColorSudokuGame';
import {
  AdBanner,
  Chip,
  ConfirmDialog,
  FONT,
  Notice,
  THEME_OPTIONS,
  useInsets,
  useScene,
  styles as shared,
} from '@/components/Scene';

type Game = ReturnType<typeof useColorSudokuGame>;
type Pending = { label: string; run(): void } | null;

export default function HomeScreen({ game }: { game: Game }) {
  const insets = useInsets();
  const scene = useScene(game.theme);
  const [difficulty, setDifficulty] = useState<Difficulty>(game.difficulty);
  const [size, setSize] = useState<BoardSize>((game.size ?? 9) as BoardSize);
  const [pending, setPending] = useState<Pending>(null);

  const tap = () => Haptics.selectionAsync().catch(() => undefined);
  const busy = !!game.busy;

  const guard = (label: string, run: () => void) => {
    tap();
    if (game.hasSavedPuzzle) setPending({ label, run });
    else run();
  };

  const preview = game.palette.slice(0, 9);
  const nextTheme = THEME_OPTIONS.find((t) => !game.unlockedThemes.includes(t.id));

  return (
    <View style={[styles.root, { backgroundColor: scene.background }]}>
      <StatusBar style={game.theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <AdBanner scene={scene} />

        <View style={styles.hero}>
          <View style={[styles.mark, { backgroundColor: scene.primary }]}>
            {preview.map((c) => (
              <View key={c.id} style={[styles.markDot, { backgroundColor: c.hex }]} />
            ))}
          </View>
          <Text style={[styles.title, { color: scene.text, fontFamily: FONT.display }]}>Palette Play</Text>
          <Text style={[styles.tagline, { color: scene.muted, fontFamily: FONT.regular }]}>
            No numbers. Just one of each color in every row, column and block.
          </Text>
        </View>

        {game.error ? <Notice scene={scene} tone="error" text={game.error} testID="text-error" /> : null}
        {game.saveError ? <Notice scene={scene} tone="error" text={game.saveError} testID="text-save-error" /> : null}
        {game.pendingResults.length ? (
          <Notice scene={scene} tone="error"
            text={`${game.pendingResults.length} completed ranked result(s) saved for upload. Retry when online. Rankings use the time your result reaches the server.`}
            action={{ label: 'Retry', onPress: game.onRetryRanking, testID: 'button-retry-pending-results' }}
            testID="pending-ranked-results" />
        ) : null}

        {game.hasSavedPuzzle ? (
          <Pressable
            onPress={() => {
              tap();
              game.onResume();
            }}
            accessibilityRole="button"
            testID="button-continue"
            style={({ pressed }) => [
              styles.continueCard,
              { backgroundColor: scene.primary },
              pressed && shared.pressed,
            ]}
          >
            <View style={styles.flex}>
              <Text style={[styles.continueEyebrow, { color: scene.card, fontFamily: FONT.bold }]}>
                UNFINISHED {game.ranked ? 'RANKED ' : game.daily ? 'DAILY ' : ''}PUZZLE
              </Text>
              <Text style={[styles.continueTitle, { color: scene.card, fontFamily: FONT.display }]}>
                Continue playing
              </Text>
              <Text style={{ color: scene.card, opacity: 0.85, fontFamily: FONT.medium, fontSize: 12 }}>
                {game.size} x {game.size} / {game.elapsed}
              </Text>
            </View>
            <View style={[styles.playCircle, { backgroundColor: scene.card }]}>
              <Ionicons name="play" size={20} color={scene.primary} />
            </View>
          </Pressable>
        ) : null}

        <View style={[styles.card, { backgroundColor: scene.card, borderColor: scene.border }]}>
          <Text style={[styles.label, { color: scene.muted, fontFamily: FONT.bold }]}>BOARD</Text>
          <View style={styles.row}>
            {boardModes.map((m) => (
              <View key={m.size} style={styles.flex}>
                <Chip
                  scene={scene}
                  label={m.label}
                  sub={m.description}
                  selected={size === m.size}
                  onPress={() => {
                    tap();
                    setSize(m.size);
                  }}
                  testID={`size-${m.size}`}
                />
              </View>
            ))}
          </View>
          <Text style={[styles.label, { color: scene.muted, fontFamily: FONT.bold, marginTop: 14 }]}>DIFFICULTY</Text>
          <View style={styles.wrap}>
            {game.difficultyOptions.map((d: { id: Difficulty; label: string }) => (
              <Chip
                key={d.id}
                scene={scene}
                label={d.label}
                selected={difficulty === d.id}
                onPress={() => {
                  tap();
                  setDifficulty(d.id);
                }}
                testID={`difficulty-${d.id}`}
              />
            ))}
          </View>

          <Pressable
            disabled={busy}
            onPress={() => guard('Start practice', () => game.onNewGame(difficulty, size))}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            testID="button-start-practice"
            style={({ pressed }) => [
              styles.bigBtn,
              { backgroundColor: scene.primary, opacity: busy ? 0.6 : 1 },
              pressed && shared.pressed,
            ]}
          >
            <Ionicons name="color-palette-outline" size={18} color={scene.card} />
            <Text style={[styles.bigBtnText, { color: scene.card, fontFamily: FONT.bold }]}>Practice puzzle</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => guard('Start ranked', () => game.onStartRanked(difficulty, size))}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            testID="button-start-ranked"
            style={({ pressed }) => [
              styles.bigBtn,
              { backgroundColor: scene.accent, opacity: busy ? 0.6 : 1 },
              pressed && shared.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={scene.card} />
            ) : (
              <Ionicons name="podium-outline" size={18} color={scene.card} />
            )}
            <Text style={[styles.bigBtnText, { color: scene.card, fontFamily: FONT.bold }]}>
              {busy ? 'Getting ranked puzzle' : 'Ranked puzzle (online)'}
            </Text>
          </Pressable>
          <Text style={[styles.fine, { color: scene.muted, fontFamily: FONT.regular }]}>
            Ranked puzzles are issued by our server and timed on its clock, pauses included.
          </Text>
        </View>

        <Pressable
          disabled={busy}
          onPress={() => guard('Start daily', () => game.onDailyChallenge(size))}
          accessibilityRole="button"
          testID="button-daily-challenge"
          style={({ pressed }) => [
            styles.daily,
            { backgroundColor: `${scene.accent}22`, borderColor: `${scene.accent}70` },
            pressed && shared.pressed,
          ]}
        >
          <View style={[styles.dailyIcon, { backgroundColor: scene.accent }]}>
            <Ionicons name="sunny-outline" size={18} color={scene.card} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.dailyTitle, { color: scene.text, fontFamily: FONT.display }]}>Daily color play</Text>
            <Text style={{ color: scene.muted, fontFamily: FONT.medium, fontSize: 12 }}>
              Today's shared {size} x {size} pattern
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={scene.primary} />
        </Pressable>

        <View style={styles.row}>
          {[
            { id: 'leaderboards' as const, label: 'Rankings', icon: 'trophy-outline' as const },
            { id: 'addons' as const, label: 'Add-ons', icon: 'sparkles-outline' as const },
          ].map((m) => (
            <Pressable
              key={m.id}
              onPress={() => {
                tap();
                game.onNavigate(m.id);
              }}
              accessibilityRole="button"
              testID={`button-menu-${m.id}`}
              style={({ pressed }) => [
                styles.menuTile,
                { backgroundColor: scene.card, borderColor: scene.border },
                pressed && shared.pressed,
              ]}
            >
              <Ionicons name={m.icon} size={22} color={scene.primary} />
              <Text style={[styles.menuText, { color: scene.text, fontFamily: FONT.display }]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: scene.card, borderColor: scene.border }]}>
          <View style={styles.between}>
            <Text style={[styles.label, { color: scene.muted, fontFamily: FONT.bold }]}>COLOR THEME</Text>
            <Text style={[styles.label, { color: scene.muted, fontFamily: FONT.bold }]} testID="text-theme-progress">
              {game.completedGames} SOLVED
            </Text>
          </View>
          <View style={styles.wrap}>
            {THEME_OPTIONS.map((t) => {
              const unlocked = game.unlockedThemes.includes(t.id);
              const active = game.theme === t.id;
              return (
                <Pressable
                  key={t.id}
                  disabled={!unlocked}
                  onPress={() => {
                    tap();
                    game.onThemeChange(t.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={unlocked ? `${t.label} theme` : `${t.label} theme locked, solve ${t.wins} puzzles`}
                  accessibilityState={{ selected: active, disabled: !unlocked }}
                  testID={`theme-${t.id}`}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: active ? `${scene.primary}20` : scene.background,
                      borderColor: active ? scene.primary : scene.border,
                      opacity: unlocked ? 1 : 0.5,
                    },
                  ]}
                >
                  <Ionicons
                    name={unlocked ? 'color-palette-outline' : 'lock-closed-outline'}
                    size={14}
                    color={active ? scene.primary : scene.muted}
                  />
                  <Text style={{ color: scene.text, fontFamily: FONT.semi, fontSize: 13 }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.fine, { color: scene.muted, fontFamily: FONT.regular }]}>
            {nextTheme ? `Next palette unlocks at ${nextTheme.wins} wins.` : 'Every palette is unlocked.'}
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        scene={scene}
        visible={pending !== null}
        title="Replace your puzzle?"
        message="You have an unfinished puzzle. Starting a new one will discard its progress."
        confirmLabel={pending?.label ?? 'Start'}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const run = pending?.run;
          setPending(null);
          run?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 0 },
  hero: { alignItems: 'center', paddingVertical: 10 },
  mark: {
    width: 76,
    height: 76,
    borderRadius: 24,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 5,
    transform: [{ rotate: '-6deg' }],
  },
  markDot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: 34, marginTop: 14 },
  tagline: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4, maxWidth: 300 },
  continueCard: { borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  continueEyebrow: { fontSize: 9, letterSpacing: 1.1, opacity: 0.85 },
  continueTitle: { fontSize: 22, marginVertical: 2 },
  playCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 8 },
  label: { fontSize: 9, letterSpacing: 1.1 },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  bigBtn: {
    minHeight: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 12,
  },
  bigBtnText: { fontSize: 15 },
  fine: { fontSize: 11, lineHeight: 16 },
  daily: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  dailyIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dailyTitle: { fontSize: 17 },
  menuTile: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, gap: 8, minHeight: 84 },
  menuText: { fontSize: 17 },
  themeBtn: {
    minHeight: 40,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

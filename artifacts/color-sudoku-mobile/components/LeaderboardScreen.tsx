import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  getGetLeaderboardQueryKey,
  useGetLeaderboard,
  type GetLeaderboardParams,
  type LeaderboardEntry,
} from '@workspace/api-client-react';

import { ensurePlayer } from '@/lib/rankings';
import { boardModes, type BoardSize, type Difficulty } from '@/lib/sudoku';
import type { useColorSudokuGame } from '@/hooks/useColorSudokuGame';
import { AdBanner, Chip, FONT, Notice, TopBar, useInsets, useScene, type Scene } from '@/components/Scene';

type Game = ReturnType<typeof useColorSudokuGame>;
type Kind = 'weekly' | 'monthly' | 'speed';

const KINDS: { id: Kind; label: string; unit: string }[] = [
  { id: 'weekly', label: 'Weekly', unit: 'Solves this week' },
  { id: 'monthly', label: 'Monthly', unit: 'Solves this month' },
  { id: 'speed', label: 'Fastest', unit: 'Best time this week' },
];

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 100)) / 10;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function formatUtc(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(
    d.getUTCMinutes(),
  ).padStart(2, '0')} UTC`;
}

function EntryRow({ scene, entry, kind, own }: { scene: Scene; entry: LeaderboardEntry; kind: Kind; own: boolean }) {
  const medal = entry.rank <= 3;
  return (
    <View
      testID={`leaderboard-entry-${entry.rank}`}
      accessibilityLabel={`Rank ${entry.rank}, ${entry.name}, ${kind === 'speed' ? formatMs(entry.value) : `${entry.value} solves`}`}
      style={[
        styles.entry,
        { borderColor: scene.border, backgroundColor: own ? `${scene.primary}18` : 'transparent' },
      ]}
    >
      <View
        style={[
          styles.rank,
          { backgroundColor: medal ? scene.accent : scene.background, borderColor: medal ? scene.accent : scene.border },
        ]}
      >
        <Text style={{ color: medal ? scene.card : scene.text, fontFamily: FONT.bold, fontSize: 12 }}>{entry.rank}</Text>
      </View>
      <Text style={[styles.flex, { color: scene.text, fontFamily: own ? FONT.bold : FONT.medium, fontSize: 14 }]} numberOfLines={1}>
        {entry.name}
        {own ? '  (you)' : ''}
      </Text>
      <Text style={{ color: scene.text, fontFamily: FONT.bold, fontSize: 14, fontVariant: ['tabular-nums'] }}>
        {kind === 'speed' ? formatMs(entry.value) : entry.value}
      </Text>
    </View>
  );
}

export default function LeaderboardScreen({ game }: { game: Game }) {
  const insets = useInsets();
  const scene = useScene(game.theme);
  const [size, setSize] = useState<BoardSize>((game.size ?? 9) as BoardSize);
  const [difficulty, setDifficulty] = useState<Difficulty>(game.difficulty);
  const [kind, setKind] = useState<Kind>('weekly');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  const connect = useCallback(() => {
    setIdentityError(null);
    ensurePlayer()
      .then((p: { id: string; name: string }) => {
        setPlayerId(p.id);
        setPlayerName(p.name);
      })
      .catch(() => setIdentityError('Could not connect to rankings. Check your connection.'));
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  const identityReady = playerId !== null;
  const params: GetLeaderboardParams = { size, difficulty, kind };
  const query = useGetLeaderboard(params, {
    query: {
      queryKey: getGetLeaderboardQueryKey(params),
      refetchInterval: 30000,
      staleTime: 10000,
      enabled: identityReady,
    },
  });
  const board = query.data;
  const ownInList = !!board?.ownRank && board.entries.some((e) => e.playerId === board.ownRank?.playerId);

  return (
    <View style={[styles.root, { backgroundColor: scene.background }]}>
      <StatusBar style={game.theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
      >
        <AdBanner scene={scene} />
        <TopBar scene={scene} title="Rankings" onBack={() => game.onNavigate('home')} />
        {playerName ? (
          <Text style={{ color: scene.muted, fontFamily: FONT.medium, fontSize: 12 }} testID="text-player-name">
            Playing as {playerName}
          </Text>
        ) : null}

        <View style={[styles.card, { backgroundColor: scene.card, borderColor: scene.border }]}>
          <View style={styles.row}>
            {KINDS.map((k) => (
              <View key={k.id} style={styles.flex}>
                <Chip scene={scene} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} testID={`kind-${k.id}`} />
              </View>
            ))}
          </View>
          <View style={styles.row}>
            {boardModes.map((m) => (
              <View key={m.size} style={styles.flex}>
                <Chip scene={scene} label={m.label} selected={size === m.size} onPress={() => setSize(m.size)} testID={`rank-size-${m.size}`} />
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {game.difficultyOptions.map((d: { id: Difficulty; label: string }) => (
              <Chip
                key={d.id}
                scene={scene}
                label={d.label}
                selected={difficulty === d.id}
                onPress={() => setDifficulty(d.id)}
                testID={`rank-difficulty-${d.id}`}
              />
            ))}
          </ScrollView>
        </View>

        <View style={[styles.card, { backgroundColor: scene.card, borderColor: scene.border }]}>
          <View style={styles.between}>
            <Text style={{ color: scene.text, fontFamily: FONT.display, fontSize: 19 }}>
              {KINDS.find((k) => k.id === kind)?.unit}
            </Text>
            {query.isFetching && board ? <ActivityIndicator size="small" color={scene.primary} /> : null}
          </View>
          {board ? (
            <Text style={{ color: scene.muted, fontFamily: FONT.regular, fontSize: 11 }} testID="text-period">
              {formatUtc(board.periodStart)} to {formatUtc(board.periodEnd)}. Resets at period end.
            </Text>
          ) : null}

          {identityError ? (
            <Notice
              scene={scene}
              tone="error"
              text={identityError}
              action={{ label: 'Retry', onPress: connect, testID: 'button-retry-identity' }}
            />
          ) : !identityReady || query.isLoading ? (
            <View style={{ gap: 8, marginTop: 4 }} testID="leaderboard-loading">
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.skeleton, { backgroundColor: scene.related, opacity: 1 - i * 0.15 }]} />
              ))}
            </View>
          ) : query.isError ? (
            <Notice
              scene={scene}
              tone="error"
              text="Could not load rankings."
              action={{ label: 'Retry', onPress: () => query.refetch(), testID: 'button-retry-leaderboard' }}
            />
          ) : board && board.entries.length > 0 ? (
            <View>
              {board.entries.map((e) => (
                <EntryRow key={`${e.rank}-${e.playerId}`} scene={scene} entry={e} kind={kind} own={e.playerId === playerId} />
              ))}
            </View>
          ) : (
            <View style={styles.empty} testID="leaderboard-empty">
              <Ionicons name="podium-outline" size={30} color={scene.muted} />
              <Text style={{ color: scene.text, fontFamily: FONT.display, fontSize: 17 }}>No ranked solves yet</Text>
              <Text style={{ color: scene.muted, fontFamily: FONT.regular, fontSize: 12, textAlign: 'center' }}>
                Finish a ranked {size} x {size} puzzle on this difficulty to open the board.
              </Text>
            </View>
          )}

          {board?.ownRank && !ownInList ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: scene.muted, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 1.1 }}>YOUR PLACE</Text>
              <EntryRow scene={scene} entry={board.ownRank} kind={kind} own />
            </View>
          ) : null}
        </View>

        <Notice
          scene={scene}
          tone="info"
          text="Only ranked puzzles issued online by our server count. Times use the server clock from issue to completion, so pauses and time in the background are included."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 0 },
  card: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  skeleton: { height: 40, borderRadius: 10 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 22 },
});

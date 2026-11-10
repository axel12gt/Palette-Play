import { useCallback, useMemo, useRef } from 'react';
import type { ElementRef } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { ColorSwatch } from '@/constants/colors';
import type { BoardSize } from '@/lib/sudoku';
import type { useColorSudokuGame } from '@/hooks/useColorSudokuGame';
import { AdBanner, FONT, Notice, useInsets, useScene, styles as shared } from '@/components/Scene';

type Game = ReturnType<typeof useColorSudokuGame>;

function PaletteBubble({
  color,
  selected,
  size,
  primary,
  onSelect,
  onDrop,
}: {
  color: ColorSwatch;
  selected: boolean;
  size: number;
  primary: string;
  onSelect(colorId: number): void;
  onDrop(colorId: number, x: number, y: number): void;
}) {
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
        onPanResponderGrant: () => selectRef.current(color.id),
        onPanResponderRelease: (_e, g) => dropRef.current(color.id, g.moveX, g.moveY),
        onPanResponderTerminationRequest: () => false,
      }),
    [color.id],
  );

  return (
    <Pressable
      {...responder.panHandlers}
      onPress={() => onSelect(color.id)}
      accessibilityRole="button"
      accessibilityLabel={`Choose ${color.name}`}
      accessibilityState={{ selected }}
      testID={`color-${color.id}`}
      style={({ pressed }) => [
        styles.paletteButton,
        { width: size, height: size, borderRadius: size / 2, borderColor: selected ? primary : 'transparent' },
        pressed && shared.pressed,
      ]}
    >
      <View
        style={{
          width: size - 12,
          height: size - 12,
          borderRadius: size,
          backgroundColor: color.hex,
          transform: [{ scale: selected ? 1 : 0.9 }],
        }}
      />
    </Pressable>
  );
}

export default function ColorSudokuScreen({ game }: { game: Game }) {
  const insets = useInsets();
  const { width, height } = useWindowDimensions();
  const scene = useScene(game.theme);
  const boardRef = useRef<ElementRef<typeof View> | null>(null);

  const size = (game.size ?? 9) as BoardSize;
  const boxRows: number = game.boxRows ?? 3;
  const boxColumns: number = game.boxColumns ?? 3;
  const palette = game.palette.slice(0, size);

  const contentWidth = Math.min(width, 520) - 32;
  const boardSize = Math.floor(
    Math.max(240, Math.min(contentWidth - 16, (height - insets.top - insets.bottom) * 0.5, 470)),
  );
  const cellSize = boardSize / size;

  // Palette: single row if it fits, otherwise two balanced rows.
  const bubbleMax = 46;
  const singleRowBubble = Math.floor((contentWidth - 26 - (size - 1) * 6) / size);
  const twoRows = singleRowBubble < 34;
  const perRow = twoRows ? Math.ceil(size / 2) : size;
  const bubbleSize = Math.min(bubbleMax, Math.floor((contentWidth - 26 - (perRow - 1) * 6) / perRow));
  const paletteRows = twoRows ? [palette.slice(0, perRow), palette.slice(perRow)] : [palette];

  const haptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const colorSelectRef = useRef(game.onColorSelect);
  colorSelectRef.current = game.onColorSelect;
  const cellSelectRef = useRef(game.onCellSelect);
  cellSelectRef.current = game.onCellSelect;

  const selectColor = useCallback(
    (colorId: number) => {
      haptic();
      colorSelectRef.current(colorId);
    },
    [haptic],
  );

  const placeColorAtPoint = useCallback(
    (colorId: number, x: number, y: number) => {
      colorSelectRef.current(colorId);
      boardRef.current?.measureInWindow((left, top, bw, bh) => {
        if (x < left || y < top || x > left + bw || y > top + bh) return;
        const column = Math.min(size - 1, Math.floor(((x - left) / bw) * size));
        const row = Math.min(size - 1, Math.floor(((y - top) / bh) * size));
        cellSelectRef.current(row * size + column);
        haptic();
      });
    },
    [haptic, size],
  );

  const sel = game.selectedCell;
  const selRow = sel === null ? -1 : Math.floor(sel / size);
  const selCol = sel === null ? -1 : sel % size;
  const noteCols = size === 4 ? 2 : 3;

  const renderCell = (index: number) => {
    const row = Math.floor(index / size);
    const column = index % size;
    const value = game.board[index];
    const related =
      sel !== null &&
      (row === selRow ||
        column === selCol ||
        (Math.floor(row / boxRows) === Math.floor(selRow / boxRows) &&
          Math.floor(column / boxColumns) === Math.floor(selCol / boxColumns)));
    const sameColor = value !== 0 && game.selectedColor !== null && value === game.selectedColor;
    const color = value ? palette[value - 1] : undefined;
    const notes: number[] = game.notes[index] ?? [];
    const isClue = !!game.clues[index];

    return (
      <Pressable
        key={index}
        onPress={() => {
          haptic();
          game.onCellSelect(index);
        }}
        accessibilityRole="button"
        accessibilityLabel={[
          `Row ${row + 1}, column ${column + 1}`,
          color ? `${color.name} color` : 'empty square',
          isClue ? 'starting clue' : '',
          game.conflicts.has(index) ? 'conflict' : '',
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityState={{ selected: sel === index }}
        testID={`cell-${index}`}
        style={({ pressed }) => [
          styles.cell,
          {
            width: cellSize,
            height: cellSize,
            backgroundColor:
              sel === index
                ? scene.selected
                : game.conflicts.has(index)
                  ? `${scene.danger}30`
                  : sameColor
                    ? `${scene.primary}32`
                    : related
                      ? scene.related
                      : scene.card,
            borderColor: scene.border,
            borderRightWidth: column === size - 1 ? 0 : column % boxColumns === boxColumns - 1 ? 2 : 0.6,
            borderBottomWidth: row === size - 1 ? 0 : row % boxRows === boxRows - 1 ? 2 : 0.6,
          },
          pressed && shared.pressed,
        ]}
      >
        {color ? (
          <View
            style={{
              width: cellSize * (isClue ? 0.6 : 0.54),
              aspectRatio: 1,
              borderRadius: 100,
              borderWidth: isClue ? 2 : 1,
              backgroundColor: color.hex,
              borderColor: isClue ? scene.text : scene.card,
              opacity: isClue ? 1 : 0.95,
            }}
          />
        ) : notes.length > 0 ? (
          <View style={styles.noteGrid}>
            {palette.map((noteColor) => (
              <View key={noteColor.id} style={[styles.noteCell, { width: `${100 / noteCols}%` }]}>
                {notes.includes(noteColor.id) ? (
                  <View
                    style={{
                      width: Math.max(3, cellSize * (size === 9 ? 0.12 : 0.16)),
                      aspectRatio: 1,
                      borderRadius: 20,
                      backgroundColor: noteColor.hex,
                    }}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    );
  };

  const actionButton = (
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    testID: string,
    disabled = false,
    active = false,
  ) => (
    <Pressable
      key={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      testID={testID}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: active ? `${scene.primary}20` : scene.card,
          borderColor: active ? scene.primary : scene.border,
          opacity: disabled ? 0.5 : 1,
        },
        pressed && !disabled && shared.pressed,
      ]}
    >
      <Ionicons name={icon} size={19} color={scene.primary} />
      <Text style={[styles.actionLabel, { color: scene.text, fontFamily: FONT.semi }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  if (!game.ready) {
    return (
      <View style={[styles.loading, { backgroundColor: scene.background, paddingTop: insets.top }]}>
        <StatusBar style={game.theme === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={scene.primary} size="large" />
        <Text style={{ color: scene.muted, fontFamily: FONT.medium }}>Preparing your puzzle</Text>
      </View>
    );
  }

  const selectedCellClearable =
    sel !== null && !game.clues[sel] && (game.board[sel] !== 0 || (game.notes[sel]?.length ?? 0) > 0);

  const modeLabel = game.ranked
    ? 'RANKED'
    : game.daily
      ? 'DAILY'
      : 'PRACTICE';
  const difficultyLabel =
    game.difficultyOptions.find((d: { id: string; label: string }) => d.id === game.difficulty)?.label ??
    game.difficulty;

  const rankingStatus: string | null | undefined = game.rankingStatus;
  const rankingFailed = !!rankingStatus && rankingStatus.startsWith('Could not');

  return (
    <View style={[styles.root, { backgroundColor: scene.background }]}>
      <StatusBar style={game.theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AdBanner scene={scene} />

        <View style={styles.header}>
          <Pressable
            onPress={() => {
              haptic();
              game.onPause();
            }}
            accessibilityRole="button"
            accessibilityLabel="Pause game"
            testID="button-pause"
            style={({ pressed }) => [
              shared.iconBtn,
              { backgroundColor: scene.card, borderColor: scene.border },
              pressed && shared.pressed,
            ]}
          >
            <Ionicons name="pause" size={19} color={scene.primary} />
          </Pressable>
          <View style={styles.headCopy}>
            <View style={styles.tagRow}>
              <View style={[styles.modeTag, { backgroundColor: game.ranked ? scene.accent : `${scene.primary}22` }]}>
                <Text
                  style={{
                    fontSize: 9,
                    letterSpacing: 1,
                    fontFamily: FONT.bold,
                    color: game.ranked ? scene.card : scene.primary,
                  }}
                >
                  {modeLabel}
                </Text>
              </View>
              <Text style={[styles.metaText, { color: scene.muted, fontFamily: FONT.bold }]} numberOfLines={1}>
                {size} x {size} / {difficultyLabel}
              </Text>
            </View>
            <Text style={[styles.heading, { color: scene.text, fontFamily: FONT.display }]} numberOfLines={1}>
              Find the color rhythm
            </Text>
          </View>
          <View style={[styles.timer, { backgroundColor: scene.card, borderColor: scene.border }]}>
            <Ionicons name="time-outline" size={14} color={scene.accent} />
            <Text style={[styles.timerText, { color: scene.text, fontFamily: FONT.bold }]} testID="text-elapsed">
              {game.elapsed}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.boardCard,
            { backgroundColor: scene.card, borderColor: scene.border, shadowColor: scene.text },
          ]}
        >
          <View
            ref={boardRef}
            collapsable={false}
            testID="board"
            style={[styles.board, { width: boardSize + 3, height: boardSize + 3, borderColor: scene.primary }]}
          >
            {Array.from({ length: size }, (_, row) => (
              <View key={row} style={styles.boardRow}>
                {Array.from({ length: size }, (_, column) => renderCell(row * size + column))}
              </View>
            ))}
          </View>
        </View>

        <View
          style={[styles.statusCard, { backgroundColor: `${scene.primary}12`, borderColor: `${scene.primary}30` }]}
        >
          <Ionicons
            name={game.complete ? 'checkmark-circle' : 'sparkles-outline'}
            size={16}
            color={game.complete ? scene.primary : scene.accent}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.statusText, { color: scene.text, fontFamily: FONT.medium }]}
            testID="status-game"
          >
            {game.status}
          </Text>
        </View>

        {game.saveError ? <Notice scene={scene} tone="error" text={game.saveError} testID="text-save-error" /> : null}

        <View style={[styles.section, { backgroundColor: scene.card, borderColor: scene.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: scene.text, fontFamily: FONT.display }]}>Color tray</Text>
            <Text style={[styles.sectionCount, { color: scene.muted, fontFamily: FONT.bold }]}>
              {size} COLORS
            </Text>
          </View>
          {paletteRows.map((row, i) => (
            <View key={`row-${i}`} style={styles.paletteRow}>
              {row.map((color) => (
                <PaletteBubble
                  key={color.id}
                  color={color}
                  selected={game.selectedColor === color.id}
                  size={bubbleSize}
                  primary={scene.primary}
                  onSelect={selectColor}
                  onDrop={placeColorAtPoint}
                />
              ))}
            </View>
          ))}
          <Text style={[styles.tip, { color: scene.muted, fontFamily: FONT.regular }]}>
            Tap a bubble then a square, or drag a bubble straight onto the board.
          </Text>
        </View>

        <View style={styles.actionGrid}>
          {actionButton(
            game.notesMode ? 'Notes on' : 'Pencil marks',
            'create-outline',
            () => {
              haptic();
              game.onToggleNotes();
            },
            'button-pencil-marks',
            false,
            game.notesMode,
          )}
          {actionButton('Undo', 'arrow-undo-outline', game.onUndo, 'button-undo', !game.canUndo)}
          {actionButton('Clear square', 'backspace-outline', game.onClear, 'button-clear', !selectedCellClearable)}
          {actionButton(`Hint ${game.hintPrice}`, 'bulb-outline', game.onHint, 'button-hint', !game.hintAvailable)}
        </View>
        {!game.hintAvailable ? (
          <Text style={[styles.tip, { color: scene.muted, fontFamily: FONT.regular, textAlign: 'center' }]}>
            Hints are planned and awaiting Google Play setup.
          </Text>
        ) : null}
      </ScrollView>

      {(game.paused || game.complete) && (
        <View
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
              backgroundColor: `${scene.background}F2`,
            },
          ]}
        >
          <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.overlayCard, { backgroundColor: scene.card, borderColor: scene.border }]}>
              <View style={[styles.overlayIcon, { backgroundColor: `${scene.primary}22` }]}>
                <Ionicons name={game.complete ? 'trophy-outline' : 'pause'} size={27} color={scene.primary} />
              </View>
              <Text style={[styles.overlayTitle, { color: scene.text, fontFamily: FONT.display }]}>
                {game.complete ? 'Beautifully solved.' : 'Take a breather'}
              </Text>
              <Text style={[styles.overlayCopy, { color: scene.muted, fontFamily: FONT.regular }]}>
                {game.complete
                  ? `Puzzle time ${game.elapsed}`
                  : game.ranked
                    ? 'Ranked clock keeps running on the server while paused.'
                    : 'Your puzzle is right here when you are ready.'}
              </Text>

              {game.complete && game.ranked && rankingStatus ? (
                <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
                  <Notice
                    scene={scene}
                    tone={rankingFailed ? 'error' : 'info'}
                    text={rankingStatus}
                    testID="text-ranking-status"
                    action={
                      rankingFailed
                        ? { label: 'Retry', onPress: game.onRetryRanking, testID: 'button-retry-ranking' }
                        : undefined
                    }
                  />
                </View>
              ) : null}

              {game.complete ? (
                <View
                  testID="completion-ad-placeholder"
                  style={[styles.adSlot, { backgroundColor: scene.background, borderColor: scene.border }]}
                >
                  <Text style={[styles.adSlotTitle, { color: scene.muted, fontFamily: FONT.bold }]}>
                    RESERVED AD PLACEMENT
                  </Text>
                  <Text style={[styles.adSlotCopy, { color: scene.muted, fontFamily: FONT.regular }]}>
                    Ads awaiting AdMob setup. Nothing is shown here.
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => {
                  haptic();
                  if (game.complete) {
                    if (game.ranked) game.onStartRanked(game.difficulty, size);
                    else if (game.daily) game.onHome();
                    else game.onNewGame(game.difficulty, size);
                  } else game.onResume();
                }}
                disabled={!!game.busy}
                accessibilityRole="button"
                testID={game.complete ? 'button-new-game-complete' : 'button-resume'}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: scene.primary, opacity: game.busy ? 0.6 : 1 },
                  pressed && shared.pressed,
                ]}
              >
                <Ionicons
                  name={game.complete ? (game.daily ? 'home-outline' : 'refresh') : 'play'}
                  size={18}
                  color={scene.card}
                />
                <Text style={[styles.primaryButtonText, { color: scene.card, fontFamily: FONT.bold }]}>
                  {game.complete
                    ? game.daily
                      ? 'Back to home'
                      : game.ranked
                        ? 'Another ranked puzzle'
                        : 'Play another'
                    : 'Resume puzzle'}
                </Text>
              </Pressable>
              {!(game.complete && game.daily) ? (
                <Pressable
                  onPress={() => {
                    haptic();
                    game.onHome();
                  }}
                  accessibilityRole="button"
                  testID={game.complete ? 'button-home-complete' : 'button-home-pause'}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: scene.border },
                    pressed && shared.pressed,
                  ]}
                >
                  <Ionicons name="home-outline" size={17} color={scene.primary} />
                  <Text style={[styles.primaryButtonText, { color: scene.text, fontFamily: FONT.bold }]}>Home</Text>
                </Pressable>
              ) : null}
              {game.error ? (
                <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
                  <Notice scene={scene} tone="error" text={game.error} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scrollContent: { paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headCopy: { flex: 1, minWidth: 0 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  metaText: { fontSize: 10, letterSpacing: 0.4, flexShrink: 1 },
  heading: { fontSize: 20, lineHeight: 25, marginTop: 2 },
  timer: {
    height: 36,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  boardCard: {
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderRadius: 22,
    elevation: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  board: { borderWidth: 1.5, borderRadius: 10, overflow: 'hidden' },
  boardRow: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  noteGrid: { width: '84%', height: '84%', flexDirection: 'row', flexWrap: 'wrap' },
  noteCell: { height: '33.333%', alignItems: 'center', justifyContent: 'center' },
  statusCard: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusText: { flex: 1, fontSize: 12, lineHeight: 17 },
  section: { borderWidth: 1, borderRadius: 18, padding: 13, gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18 },
  sectionCount: { fontSize: 9, letterSpacing: 0.9 },
  paletteRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  paletteButton: { borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  tip: { fontSize: 11, lineHeight: 16 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },
  actionLabel: { fontSize: 13 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 18 },
  overlayScroll: { flexGrow: 1, justifyContent: 'center' },
  overlayCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
  },
  overlayIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  overlayTitle: { fontSize: 26, marginTop: 12, textAlign: 'center' },
  overlayCopy: { fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' },
  adSlot: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    alignItems: 'center',
    gap: 4,
  },
  adSlotTitle: { fontSize: 9, letterSpacing: 1.1 },
  adSlotCopy: { fontSize: 11, textAlign: 'center' },
  primaryButton: {
    alignSelf: 'stretch',
    minHeight: 50,
    borderRadius: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButton: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { fontSize: 15 },
});

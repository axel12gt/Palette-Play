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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/hooks/useColors';
import {
  sceneThemes,
  type ColorSwatch,
  type GameTheme,
} from '@/constants/colors';
import type { useColorSudokuGame } from '@/hooks/useColorSudokuGame';

type Game = ReturnType<typeof useColorSudokuGame>;

const THEME_OPTIONS: { id: GameTheme; label: string; wins: number }[] = [
  { id: 'classic', label: 'Classic', wins: 0 },
  { id: 'pastel', label: 'Pastel', wins: 1 },
  { id: 'neon', label: 'Neon', wins: 3 },
  { id: 'dark', label: 'Dark', wins: 5 },
];

function PaletteBubble({
  color,
  selected,
  compact,
  primary,
  onSelect,
  onDragStart,
  onDrop,
}: {
  color: ColorSwatch;
  selected: boolean;
  compact: boolean;
  primary: string;
  onSelect(colorId: number): void;
  onDragStart(colorId: number): void;
  onDrop(colorId: number, x: number, y: number): void;
}) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
        onPanResponderGrant: () => onDragStart(color.id),
        onPanResponderRelease: (_event, gesture) =>
          onDrop(color.id, gesture.moveX, gesture.moveY),
        onPanResponderTerminationRequest: () => false,
      }),
    [color.id, onDragStart, onDrop],
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
        compact && styles.paletteButtonCompact,
        selected && { borderColor: primary },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.paletteDot,
          compact && styles.paletteDotCompact,
          { backgroundColor: color.hex, borderColor: primary },
        ]}
      />
    </Pressable>
  );
}

export default function ColorSudokuScreen({ game }: { game: Game }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const systemColors = useColors();
  const boardRef = useRef<ElementRef<typeof View> | null>(null);
  const scene =
    game.theme === 'classic'
      ? {
          ...sceneThemes.classic,
          background: systemColors.background,
          card: systemColors.card,
          text: systemColors.foreground,
          muted: systemColors.mutedForeground,
          primary: systemColors.primary,
          accent: systemColors.accent,
          border: systemColors.border,
          related: systemColors.secondary,
          selected: systemColors.accent,
          danger: systemColors.destructive,
        }
      : sceneThemes[game.theme];

  const boardSize = Math.max(
    220,
    Math.min(width - 48, (height - insets.top - insets.bottom) * 0.46, 460),
  );
  const compactPalette = width < 360;
  const paletteRows = compactPalette
    ? [game.palette.slice(0, 3), game.palette.slice(3, 6), game.palette.slice(6)]
    : [game.palette];

  const haptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const selectColor = useCallback(
    (colorId: number) => {
      haptic();
      game.onColorSelect(colorId);
    },
    [game.onColorSelect, haptic],
  );

  const placeColorAtPoint = useCallback(
    (colorId: number, x: number, y: number) => {
      game.onColorSelect(colorId);
      boardRef.current?.measureInWindow((left, top, boardWidth, boardHeight) => {
        if (
          x < left ||
          y < top ||
          x > left + boardWidth ||
          y > top + boardHeight
        ) {
          return;
        }
        const column = Math.min(8, Math.floor(((x - left) / boardWidth) * 9));
        const row = Math.min(8, Math.floor(((y - top) / boardHeight) * 9));
        game.onCellSelect(row * 9 + column);
        haptic();
      });
    },
    [game.onCellSelect, game.onColorSelect, haptic],
  );

  const onDragStart = useCallback(
    (colorId: number) => {
      selectColor(colorId);
    },
    [selectColor],
  );

  const renderCell = (index: number, cellSize: number) => {
    const row = Math.floor(index / 9);
    const column = index % 9;
    const value = game.board[index];
    const selectedRow =
      game.selectedCell === null ? -1 : Math.floor(game.selectedCell / 9);
    const selectedColumn =
      game.selectedCell === null ? -1 : game.selectedCell % 9;
    const related =
      game.selectedCell !== null &&
      (row === selectedRow ||
        column === selectedColumn ||
        (Math.floor(row / 3) === Math.floor(selectedRow / 3) &&
          Math.floor(column / 3) === Math.floor(selectedColumn / 3)));
    const sameColor =
      value !== 0 && game.selectedColor !== null && value === game.selectedColor;
    const color = value ? game.palette[value - 1] : undefined;
    const notes = game.notes[index] ?? [];

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
          game.clues[index] ? 'starting clue' : '',
          game.conflicts.has(index) ? 'conflict' : '',
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityState={{ selected: game.selectedCell === index }}
        testID={`cell-${index}`}
        style={({ pressed }) => [
          styles.cell,
          {
            width: cellSize,
            height: cellSize,
            backgroundColor:
              game.selectedCell === index
                ? scene.selected
                : game.conflicts.has(index)
                  ? `${scene.danger}30`
                  : sameColor
                    ? `${scene.primary}32`
                    : related
                      ? scene.related
                      : scene.card,
            borderColor: scene.border,
            borderRightWidth: column === 8 ? 0 : column % 3 === 2 ? 2 : 0.6,
            borderBottomWidth: row === 8 ? 0 : row % 3 === 2 ? 2 : 0.6,
          },
          pressed && styles.pressed,
        ]}
      >
        {color ? (
          <View
            style={[
              styles.cellColor,
              {
                width: cellSize * (game.clues[index] ? 0.57 : 0.52),
                backgroundColor: color.hex,
                borderColor: game.clues[index]
                  ? scene.border
                  : scene.card,
              },
            ]}
          />
        ) : notes.length > 0 ? (
          <View style={styles.noteGrid}>
            {game.palette.map((noteColor) => (
              <View key={noteColor.id} style={styles.noteCell}>
                {notes.includes(noteColor.id) ? (
                  <View
                    style={[
                      styles.noteDot,
                      {
                        width: Math.max(3, cellSize * 0.115),
                        backgroundColor: noteColor.hex,
                      },
                    ]}
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
  ) => (
    <Pressable
      key={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: scene.card,
          borderColor: scene.border,
          opacity: disabled ? 0.54 : 1,
        },
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={19} color={scene.primary} />
      <Text style={[styles.actionLabel, { color: scene.text }]}>{label}</Text>
    </Pressable>
  );

  const solvedMessage = game.complete
    ? 'Great work. Every row, column, and block has one of each color.'
    : game.status;

  if (!game.ready) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: scene.background, paddingTop: insets.top },
        ]}
      >
        <StatusBar style={game.theme === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={scene.primary} size="large" />
        <Text style={[styles.loadingText, { color: scene.muted }]}>
          Preparing your puzzle
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: scene.background }]}>
      <StatusBar style={game.theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 26,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={[styles.brandMark, { backgroundColor: scene.primary }]}>
              {game.palette.map((item) => (
                <View
                  key={item.id}
                  style={[styles.brandDot, { backgroundColor: item.hex }]}
                />
              ))}
            </View>
            <View>
              <Text
                style={[
                  styles.brandTitle,
                  { color: scene.text, fontFamily: 'Fraunces_600SemiBold' },
                ]}
              >
                Color Sudoku
              </Text>
              <Text
                style={[
                  styles.brandCaption,
                  { color: scene.muted, fontFamily: 'DMSans_700Bold' },
                ]}
              >
                A little logic, a lot of color
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              game.onPause();
              haptic();
            }}
            accessibilityRole="button"
            accessibilityLabel="Pause game"
            testID="button-pause"
            style={({ pressed }) => [
              styles.pauseButton,
              {
                backgroundColor: scene.card,
                borderColor: scene.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="pause" size={19} color={scene.primary} />
          </Pressable>
        </View>

        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text
              style={[
                styles.eyebrow,
                { color: scene.primary, fontFamily: 'DMSans_700Bold' },
              ]}
            >
              {game.daily ? "TODAY'S COLOR CHALLENGE" : `${game.difficulty.replace('-', ' ').toUpperCase()} PUZZLE`}
            </Text>
            <Text
              style={[
                styles.heading,
                { color: scene.text, fontFamily: 'Fraunces_600SemiBold' },
              ]}
            >
              Find the color rhythm
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: scene.muted, fontFamily: 'DMSans_400Regular' },
              ]}
            >
              One of each color in every row, column, and square.
            </Text>
          </View>
          <View style={[styles.timer, { backgroundColor: scene.card, borderColor: scene.border }]}>
            <Ionicons name="time-outline" size={15} color={scene.accent} />
            <Text
              style={[
                styles.timerText,
                { color: scene.text, fontFamily: 'DMSans_700Bold' },
              ]}
              testID="text-elapsed"
            >
              {game.elapsed}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.boardCard,
            {
              backgroundColor: scene.card,
              borderColor: scene.border,
              borderRadius: 22,
              shadowColor: scene.text,
            },
          ]}
        >
          <View
            ref={boardRef}
            collapsable={false}
            style={[
              styles.board,
              {
                width: boardSize,
                height: boardSize,
                borderColor: scene.primary,
              },
            ]}
          >
            {Array.from({ length: 9 }, (_, row) => (
              <View key={row} style={styles.boardRow}>
                {Array.from({ length: 9 }, (_, column) =>
                  renderCell(row * 9 + column, boardSize / 9),
                )}
              </View>
            ))}
          </View>
          <View style={styles.boardCaption}>
            <View style={styles.captionItem}>
              <Ionicons name="scan-outline" size={14} color={scene.primary} />
              <Text style={[styles.captionText, { color: scene.muted }]}>
                Matching colors glow
              </Text>
            </View>
            <Text style={[styles.captionText, { color: scene.muted }]}>
              Drag a color to place
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: `${scene.primary}12`,
              borderColor: `${scene.primary}30`,
            },
          ]}
        >
          <Ionicons
            name={game.complete ? 'checkmark-circle' : 'sparkles-outline'}
            size={16}
            color={game.complete ? scene.primary : scene.accent}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.statusText,
              { color: scene.text, fontFamily: 'DMSans_500Medium' },
            ]}
            testID="status-game"
          >
            {solvedMessage}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: scene.card, borderColor: scene.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: scene.text, fontFamily: 'Fraunces_600SemiBold' }]}>
                Color tray
              </Text>
              <Text style={[styles.sectionSubtitle, { color: scene.muted }]}>
                Tap a bubble or drag it to a square.
              </Text>
            </View>
            <Text style={[styles.sectionCount, { color: scene.muted }]}>9 COLORS</Text>
          </View>
          {paletteRows.map((row, rowIndex) => (
            <View
              key={`palette-row-${rowIndex}`}
              style={[styles.paletteRow, compactPalette && styles.paletteRowCompact]}
            >
              {row.map((color) => (
                <PaletteBubble
                  key={color.id}
                  color={color}
                  selected={game.selectedColor === color.id}
                  compact={compactPalette}
                  primary={scene.primary}
                  onSelect={selectColor}
                  onDragStart={onDragStart}
                  onDrop={placeColorAtPoint}
                />
              ))}
            </View>
          ))}
          <View style={styles.paletteTip}>
            <Ionicons name="bulb-outline" size={14} color={scene.accent} />
            <Text style={[styles.paletteTipText, { color: scene.muted }]}>
              Matching colors highlight across the whole board.
            </Text>
          </View>
        </View>

        <View style={styles.actionGrid}>
          {actionButton(
            game.notesMode ? 'Notes on' : 'Pencil marks',
            'create-outline',
            () => {
              game.onToggleNotes();
              haptic();
            },
            'button-pencil-marks',
          )}
          {actionButton(
            'Undo',
            'arrow-undo-outline',
            game.onUndo,
            'button-undo',
            !game.canUndo,
          )}
          {actionButton(
            'Clear square',
            'trash-outline',
            game.onClear,
            'button-clear',
            game.selectedCell === null ||
              game.clues[game.selectedCell] ||
              (game.board[game.selectedCell] === 0 &&
                game.notes[game.selectedCell].length === 0),
          )}
          {actionButton(
            `Hint · ${game.hintPrice}`,
            'bulb-outline',
            game.onHint,
            'button-hint',
            !game.hintAvailable,
          )}
        </View>

        <View style={[styles.section, { backgroundColor: scene.card, borderColor: scene.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: scene.text, fontFamily: 'Fraunces_600SemiBold' }]}>
                Choose your puzzle
              </Text>
              <Text style={[styles.sectionSubtitle, { color: scene.muted }]}>
                New patterns always have one solution.
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.difficultyRow}
          >
            {game.difficultyOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  game.onNewGame(option.id);
                  haptic();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: game.difficulty === option.id }}
                testID={`difficulty-${option.id}`}
                style={[
                  styles.difficultyButton,
                  {
                    backgroundColor:
                      game.difficulty === option.id
                        ? `${scene.primary}20`
                        : scene.background,
                    borderColor:
                      game.difficulty === option.id ? scene.primary : scene.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.difficultyText,
                    {
                      color:
                        game.difficulty === option.id ? scene.primary : scene.muted,
                      fontFamily: 'DMSans_700Bold',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.themeHeading}>
            <Text style={[styles.themeLabel, { color: scene.muted }]}>COLOR THEME</Text>
            <Text style={[styles.themeProgress, { color: scene.muted }]} testID="text-theme-progress">
              {game.completedGames} solved
            </Text>
          </View>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const unlocked = game.unlockedThemes.includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  disabled={!unlocked}
                  onPress={() => {
                    game.onThemeChange(option.id);
                    haptic();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    unlocked
                      ? `${option.label} color theme`
                      : `${option.label} theme locked; solve ${option.wins} puzzles to unlock`
                  }
                  accessibilityState={{
                    selected: game.theme === option.id,
                    disabled: !unlocked,
                  }}
                  testID={`theme-${option.id}`}
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor:
                        game.theme === option.id
                          ? `${scene.primary}20`
                          : scene.background,
                      borderColor:
                        game.theme === option.id ? scene.primary : scene.border,
                      opacity: unlocked ? 1 : 0.48,
                    },
                  ]}
                >
                  <Ionicons
                    name={unlocked ? 'color-palette-outline' : 'lock-closed-outline'}
                    size={14}
                    color={game.theme === option.id ? scene.primary : scene.muted}
                  />
                  <Text
                    style={[
                      styles.themeButtonText,
                      { color: scene.text, fontFamily: 'DMSans_600SemiBold' },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {THEME_OPTIONS.some((option) => !game.unlockedThemes.includes(option.id)) ? (
            <Text style={[styles.unlockText, { color: scene.muted }]}>
              Next palette: solve {THEME_OPTIONS.find((option) => !game.unlockedThemes.includes(option.id))?.wins} puzzles.
            </Text>
          ) : (
            <Text style={[styles.unlockText, { color: scene.muted }]}>
              Every palette is unlocked.
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => {
            game.onDailyChallenge();
            haptic();
          }}
          accessibilityRole="button"
          testID="button-daily-challenge"
          style={({ pressed }) => [
            styles.dailyButton,
            { backgroundColor: `${scene.accent}25`, borderColor: `${scene.accent}75` },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.dailyIcon, { backgroundColor: scene.accent }]}>
            <Ionicons name="sparkles" size={17} color={scene.card} />
          </View>
          <View style={styles.dailyCopy}>
            <Text style={[styles.dailyTitle, { color: scene.text, fontFamily: 'Fraunces_600SemiBold' }]}>
              Daily color play
            </Text>
            <Text style={[styles.dailySubtitle, { color: scene.muted }]}>
              One shared pattern for today
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={scene.primary} />
        </Pressable>
      </ScrollView>

      {(game.paused || game.complete) && (
        <View
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
              backgroundColor: `${scene.background}F2`,
            },
          ]}
        >
          <View style={[styles.overlayCard, { backgroundColor: scene.card, borderColor: scene.border }]}>
            <View style={[styles.overlayIcon, { backgroundColor: `${scene.primary}22` }]}>
              <Ionicons
                name={game.complete ? 'trophy-outline' : 'pause'}
                size={27}
                color={scene.primary}
              />
            </View>
            <Text style={[styles.overlayTitle, { color: scene.text, fontFamily: 'Fraunces_600SemiBold' }]}>
              {game.complete ? 'Beautifully solved.' : 'Take a breather'}
            </Text>
            <Text style={[styles.overlayCopy, { color: scene.muted }]}>
              {game.complete
                ? `Puzzle time: ${game.elapsed}`
                : 'Your puzzle is right here when you are ready.'}
            </Text>
            {game.complete ? (
              <View style={[styles.adSlot, { backgroundColor: scene.background, borderColor: scene.border }]}>
                <Text style={[styles.adSlotTitle, { color: scene.muted }]}>
                  RESERVED AD PLACEMENT
                </Text>
                <Text style={[styles.adSlotCopy, { color: scene.muted }]}>
                  This space is intentionally empty. No advertisement is shown.
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => {
                if (game.complete) game.onNewGame(game.difficulty);
                else game.onResume();
                haptic();
              }}
              accessibilityRole="button"
              testID={game.complete ? 'button-new-game-complete' : 'button-resume'}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: scene.primary },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={game.complete ? 'refresh' : 'play'}
                size={18}
                color={scene.card}
              />
              <Text style={[styles.primaryButtonText, { color: scene.card, fontFamily: 'DMSans_700Bold' }]}>
                {game.complete ? 'Play another' : 'Resume puzzle'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    padding: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  brandDot: { width: 6, height: 6, borderRadius: 3 },
  brandTitle: { fontSize: 20, lineHeight: 24 },
  brandCaption: { marginTop: 2, fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase' },
  pauseButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 1,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, letterSpacing: 1.1 },
  heading: { fontSize: 27, lineHeight: 32, marginTop: 3 },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  timer: {
    height: 36,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 1,
  },
  timerText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  boardCard: {
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  board: {
    borderWidth: 1.5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  boardRow: { flex: 1, flexDirection: 'row' },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
  },
  cellColor: {
    aspectRatio: 1,
    borderRadius: 100,
    borderWidth: 1,
  },
  noteGrid: {
    width: '82%',
    height: '82%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  noteCell: {
    width: '33.333%',
    height: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteDot: { aspectRatio: 1, borderRadius: 20 },
  boardCaption: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 9,
  },
  captionItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  captionText: { fontSize: 9, fontWeight: '600' },
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
  statusText: { flex: 1, fontSize: 11, lineHeight: 16 },
  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18 },
  sectionSubtitle: { fontSize: 10, marginTop: 2 },
  sectionCount: { fontSize: 8, letterSpacing: 0.9, fontWeight: '800' },
  paletteRow: { flexDirection: 'row', gap: 3, justifyContent: 'space-between' },
  paletteRowCompact: { gap: 5, marginBottom: 5 },
  paletteButton: {
    flex: 1,
    minWidth: 28,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  paletteButtonCompact: { flex: 1, height: 46, minWidth: 44 },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 50,
    borderWidth: 1,
  },
  paletteDotCompact: { width: 33, height: 33 },
  paletteTip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  paletteTipText: { fontSize: 10, flex: 1 },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  actionButton: {
    width: '48.5%',
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionLabel: { fontSize: 11, fontWeight: '700' },
  difficultyRow: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  difficultyButton: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyText: { fontSize: 9 },
  themeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
    marginBottom: 7,
  },
  themeLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  themeProgress: { fontSize: 9 },
  themeRow: { flexDirection: 'row', gap: 5 },
  themeButton: {
    flex: 1,
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  themeButtonText: { fontSize: 8 },
  unlockText: { fontSize: 9, marginTop: 7, textAlign: 'center' },
  dailyButton: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    gap: 10,
  },
  dailyIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyCopy: { flex: 1 },
  dailyTitle: { fontSize: 14 },
  dailySubtitle: { fontSize: 10, marginTop: 2 },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 390,
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  overlayIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  overlayTitle: { fontSize: 25, textAlign: 'center' },
  overlayCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7, marginBottom: 16 },
  adSlot: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },
  adSlotTitle: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  adSlotCopy: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  primaryButton: {
    minHeight: 45,
    width: '100%',
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryButtonText: { fontSize: 12 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});

import type { ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { sceneThemes, type GameTheme } from '@/constants/colors';

export type Scene = (typeof sceneThemes)['classic'];

export const THEME_OPTIONS: { id: GameTheme; label: string; wins: number }[] = [
  { id: 'classic', label: 'Classic', wins: 0 },
  { id: 'pastel', label: 'Pastel', wins: 1 },
  { id: 'neon', label: 'Neon', wins: 3 },
  { id: 'dark', label: 'Dark', wins: 5 },
];

export const FONT = {
  display: 'Fraunces_600SemiBold',
  bold: 'DMSans_700Bold',
  semi: 'DMSans_600SemiBold',
  medium: 'DMSans_500Medium',
  regular: 'DMSans_400Regular',
};

export function useScene(theme: GameTheme): Scene {
  const c = useColors();
  if (theme !== 'classic') return sceneThemes[theme];
  return {
    ...sceneThemes.classic,
    background: c.background,
    card: c.card,
    text: c.foreground,
    muted: c.mutedForeground,
    primary: c.primary,
    accent: c.accent,
    border: c.border,
    related: c.secondary,
    selected: c.accent,
    danger: c.destructive,
  };
}

/** Safe insets with web minimums (67 top / 34 bottom). */
export function useInsets() {
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  return {
    top: web ? Math.max(67, insets.top) : insets.top,
    bottom: web ? Math.max(34, insets.bottom) : insets.bottom,
  };
}

export function AdBanner({ scene }: { scene: Scene }) {
  return (
    <View
      testID="ad-banner-placeholder"
      accessibilityLabel="Reserved banner. Ads awaiting account setup. No ad is shown."
      style={[styles.banner, { borderColor: scene.border, backgroundColor: `${scene.muted}10` }]}
    >
      <Text style={[styles.bannerTag, { color: scene.muted, borderColor: scene.border, fontFamily: FONT.bold }]}>
        AD SPACE
      </Text>
      <Text style={[styles.bannerText, { color: scene.muted, fontFamily: FONT.medium }]} numberOfLines={1}>
        Ads awaiting account setup
      </Text>
    </View>
  );
}

export function TopBar({
  scene,
  title,
  onBack,
  right,
}: {
  scene: Scene;
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          testID="button-back"
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: scene.card, borderColor: scene.border },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={scene.primary} />
        </Pressable>
      ) : null}
      <Text style={[styles.topTitle, { color: scene.text, fontFamily: FONT.display }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Chip({
  scene,
  label,
  selected,
  onPress,
  testID,
  sub,
}: {
  scene: Scene;
  label: string;
  selected: boolean;
  onPress(): void;
  testID: string;
  sub?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? `${scene.primary}20` : scene.card,
          borderColor: selected ? scene.primary : scene.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? scene.primary : scene.text, fontFamily: FONT.bold }]}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.chipSub, { color: scene.muted, fontFamily: FONT.medium }]}>{sub}</Text>
      ) : null}
    </Pressable>
  );
}

export function ConfirmDialog({
  scene,
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  scene: Scene;
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.modalBackdrop, { backgroundColor: `${scene.text}55` }]}>
        <View
          accessibilityViewIsModal
          style={[styles.modalCard, { backgroundColor: scene.card, borderColor: scene.border }]}
        >
          <View style={[styles.modalIcon, { backgroundColor: `${scene.accent}25` }]}>
            <Ionicons name="swap-horizontal" size={22} color={scene.accent} />
          </View>
          <Text style={[styles.modalTitle, { color: scene.text, fontFamily: FONT.display }]}>{title}</Text>
          <Text style={[styles.modalCopy, { color: scene.muted, fontFamily: FONT.regular }]}>{message}</Text>
          <View style={styles.modalRow}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              testID="button-confirm-cancel"
              style={({ pressed }) => [
                styles.modalBtn,
                { borderColor: scene.border, backgroundColor: scene.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.modalBtnText, { color: scene.text, fontFamily: FONT.bold }]}>Keep puzzle</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              testID="button-confirm-replace"
              style={({ pressed }) => [
                styles.modalBtn,
                { borderColor: scene.primary, backgroundColor: scene.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.modalBtnText, { color: scene.card, fontFamily: FONT.bold }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Notice({
  scene,
  tone,
  text,
  testID,
  action,
}: {
  scene: Scene;
  tone: 'error' | 'info';
  text: string;
  testID?: string;
  action?: { label: string; onPress(): void; testID: string };
}) {
  const color = tone === 'error' ? scene.danger : scene.primary;
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: `${color}14`, borderColor: `${color}44` }]}
    >
      <Ionicons name={tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'} size={16} color={color} />
      <Text style={[styles.noticeText, { color: scene.text, fontFamily: FONT.medium }]}>{text}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          testID={action.testID}
          style={({ pressed }) => [styles.noticeBtn, { borderColor: color }, pressed && styles.pressed]}
        >
          <Text style={{ color, fontFamily: FONT.bold, fontSize: 12 }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  banner: {
    height: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  bannerTag: { fontSize: 8, letterSpacing: 1, borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  bannerText: { fontSize: 11, flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  topTitle: { flex: 1, fontSize: 24 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { minHeight: 44, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, justifyContent: 'center' },
  chipText: { fontSize: 13 },
  chipSub: { fontSize: 10, marginTop: 1 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  modalCard: { width: '100%', maxWidth: 380, borderRadius: 24, borderWidth: 1, padding: 20, alignItems: 'center' },
  modalIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 22, textAlign: 'center' },
  modalCopy: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
  modalBtn: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  modalBtnText: { fontSize: 13, textAlign: 'center' },
  notice: { borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  noticeBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, minHeight: 34, justifyContent: 'center' },
});

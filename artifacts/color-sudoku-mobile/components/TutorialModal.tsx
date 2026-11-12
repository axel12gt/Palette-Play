import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, type Scene } from '@/components/Scene';

const lessons = [
  {
    icon: 'ellipse' as const,
    title: 'One of each color',
    body: 'Fill every empty space so each color appears once in every row, column, and box. The board has no numbers.',
  },
  {
    icon: 'color-palette' as const,
    title: 'Choose, then place',
    body: 'Tap a color bubble, then tap an empty square. Or drag the bubble right onto a square. Matching colors light up to help you scan.',
  },
  {
    icon: 'create' as const,
    title: 'Use color notes',
    body: 'Turn on Notes when you are unsure. Add tiny color dots as possibilities; tap the same color again to remove a note.',
  },
  {
    icon: 'pause' as const,
    title: 'Play at your pace',
    body: 'Undo a move or pause whenever you like. Your puzzle is saved on this device, so you can return to it from Home.',
  },
];

export default function TutorialModal({
  scene,
  visible,
  onClose,
}: {
  scene: Scene;
  visible: boolean;
  onClose(): void;
}) {
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();
  const lesson = lessons[step];
  const finish = () => { setStep(0); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={finish}>
      <View style={[styles.backdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.card, { backgroundColor: scene.card, borderColor: scene.border }]} accessibilityViewIsModal>
          <View style={[styles.icon, { backgroundColor: `${scene.primary}18` }]}>
            <Ionicons name={lesson.icon} size={26} color={scene.primary} />
          </View>
          <Text style={[styles.kicker, { color: scene.muted, fontFamily: FONT.bold }]}>HOW TO PLAY · {step + 1} OF {lessons.length}</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: scene.text, fontFamily: FONT.display }]}>{lesson.title}</Text>
          <ScrollView style={styles.copyScroll} contentContainerStyle={styles.copyContent}>
            <Text style={[styles.copy, { color: scene.muted, fontFamily: FONT.regular }]}>{lesson.body}</Text>
          </ScrollView>
          <View style={styles.dots} accessibilityLabel={`Lesson ${step + 1} of ${lessons.length}`}>
            {lessons.map((item, index) => (
              <View key={item.title} style={[styles.dot, { backgroundColor: index === step ? scene.primary : scene.border }]} />
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={finish} accessibilityRole="button" testID="button-tutorial-skip" style={[styles.secondary, { borderColor: scene.border }]}>
              <Text style={[styles.secondaryText, { color: scene.muted, fontFamily: FONT.semi }]}>Skip</Text>
            </Pressable>
            {step > 0 && (
              <Pressable onPress={() => setStep((value) => value - 1)} accessibilityRole="button" testID="button-tutorial-back" style={[styles.secondary, { borderColor: scene.border }]}>
                <Text style={[styles.secondaryText, { color: scene.muted, fontFamily: FONT.semi }]}>Back</Text>
              </Pressable>
            )}
            <Pressable onPress={step === lessons.length - 1 ? finish : () => setStep((value) => value + 1)}
              accessibilityRole="button" testID={step === lessons.length - 1 ? 'button-tutorial-done' : 'button-tutorial-next'}
              style={[styles.primary, { backgroundColor: scene.primary }]}>
              <Text style={[styles.primaryText, { color: scene.card, fontFamily: FONT.bold }]}>{step === lessons.length - 1 ? 'Let’s play' : 'Next'}</Text>
              <Ionicons name={step === lessons.length - 1 ? 'checkmark' : 'arrow-forward'} size={16} color={scene.card} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#13231e99', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  card: { width: '100%', maxWidth: 420, maxHeight: '90%', borderWidth: 1, borderRadius: 24, padding: 22 },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  kicker: { fontSize: 10, letterSpacing: 1.3, marginBottom: 8 },
  title: { fontSize: 26, lineHeight: 32, marginBottom: 12 },
  copyScroll: { flexGrow: 0, flexShrink: 1, minHeight: 72 },
  copyContent: { paddingBottom: 4 },
  copy: { fontSize: 15, lineHeight: 23 },
  dots: { flexDirection: 'row', gap: 7, marginTop: 20, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  secondary: { minHeight: 44, paddingHorizontal: 13, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 13 },
  primary: { minHeight: 46, paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryText: { fontSize: 13 },
});

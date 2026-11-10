import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { enableOnlineRankings, rankingPrivacy, type RankingPrivacy } from '@/lib/rankings';
import { FONT, type Scene } from '@/components/Scene';

export default function RankingPrivacyControls({
  scene, busy, onDelete,
}: {
  scene: Scene;
  busy: boolean;
  onDelete(): Promise<void>;
}) {
  const [privacy, setPrivacy] = useState<RankingPrivacy | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    rankingPrivacy().then(setPrivacy).catch(() => {
      setFailed(true);
      setMessage('Could not read privacy settings. Reopen Add-ons to retry.');
    });
  }, []);
  const textStyle = { color: scene.muted, fontFamily: FONT.regular, fontSize: 13, lineHeight: 19 };
  const remove = async () => {
    if (working || busy) return;
    setWorking(true); setFailed(false); setMessage('');
    try {
      await onDelete();
      setPrivacy('deleted'); setConfirm(false);
      setMessage('Online ranking data deleted. Your offline puzzle and unlocked themes are still here.');
    } catch {
      setPrivacy(await rankingPrivacy().catch(() => 'deleting' as const));
      setFailed(true);
      setMessage('Deletion was not confirmed. Check your connection and retry. The device keeps the key needed to finish deletion.');
    } finally { setWorking(false); }
  };
  const enable = async () => {
    setWorking(true); setFailed(false); setMessage('');
    try {
      await enableOnlineRankings();
      setPrivacy('active');
      setMessage('Rankings enabled. A new random profile will be created next time you use online rankings. Deleted results cannot be recovered.');
    } catch {
      setFailed(true); setMessage('Could not enable rankings. Please try again.');
    } finally { setWorking(false); }
  };
  const button = (label: string, onPress: () => void, id: string, destructive = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: working || busy || privacy === null }}
      disabled={working || busy || privacy === null}
      testID={id}
      onPress={onPress}
      style={({ pressed }) => [styles.button, {
        borderColor: destructive ? scene.danger : scene.primary,
        backgroundColor: destructive ? `${scene.danger}12` : `${scene.primary}12`,
        opacity: pressed || working || busy ? 0.55 : 1,
      }]}
    >
      <Text style={{ color: destructive ? scene.danger : scene.primary, fontFamily: FONT.bold, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={[styles.card, { backgroundColor: scene.card, borderColor: scene.border }]} testID="ranking-privacy">
      <View style={styles.heading}>
        <Ionicons name="shield-checkmark-outline" color={scene.primary} size={22} />
        <Text style={{ color: scene.text, fontFamily: FONT.display, fontSize: 21 }}>Privacy & online data</Text>
      </View>
      <Text style={textStyle}>
        Practice stays on this device. Opening Rankings or starting ranked play creates a random player name and identity online.
        No real name, email, birthday or location is requested.
      </Text>
      <Text style={textStyle}>
        Online storage includes that random profile, a protected device-key hash, issued puzzles and solutions, board sizes,
        difficulty, start and finish times, and completion results. Your random name and scores appear on public leaderboards.
      </Text>
      <Text style={textStyle}>
        Online results are kept for the calendar month they were completed in. They stop appearing at midnight UTC
        on the first day of the next month, even if earned on the last day. Older records are removed during cleanup,
        which runs hourly and on the first online request after a month changes.
        Unfinished ranked puzzles from the previous month expire too. Older profiles with no current-month puzzles are removed.
        Weekly and fastest-time rankings also lose previous-month results at this reset.
      </Text>
      <Text style={textStyle}>
        The device key is your access to this profile. Uninstalling or clearing device storage can lose that access;
        there is no email recovery. Delete online data here first if you want it removed immediately.
        This control covers the game's live ranking database, not service logs or backups.
      </Text>
      <Text style={textStyle}>Ads and real-money purchases are currently off.</Text>
      {privacy === 'deleted' ? (
        <>
          <Text style={[textStyle, { color: scene.primary }]} testID="privacy-rankings-off">
            Online rankings are off. No replacement profile is created unless you enable rankings below.
          </Text>
          {button('Enable online rankings', () => void enable(), 'privacy-enable-rankings')}
        </>
      ) : confirm || privacy === 'deleting' ? (
        <View style={[styles.confirm, { borderColor: scene.danger }]} testID="privacy-delete-confirmation">
          <Text style={{ color: scene.text, fontFamily: FONT.bold, fontSize: 15 }}>Delete all online ranking data?</Text>
          <Text style={textStyle}>
            This permanently removes your online profile, issued puzzles, scores and times. It cannot be undone.
            Your current puzzle becomes practice; local progress and unlocked themes stay.
            Online rankings will remain off until you explicitly enable them.
          </Text>
          {button(privacy === 'deleting' ? 'Retry deletion' : 'Delete permanently', () => void remove(), 'privacy-confirm-delete', true)}
          {privacy !== 'deleting' ? button('Keep my data', () => setConfirm(false), 'privacy-cancel-delete') : null}
        </View>
      ) : (
        button('Delete online ranking data', () => { setConfirm(true); setMessage(''); }, 'privacy-delete-data', true)
      )}
      {working ? <ActivityIndicator color={scene.primary} accessibilityLabel="Updating ranking privacy" /> : null}
      {message ? <Text accessibilityLiveRegion="polite" testID="privacy-status"
        style={[textStyle, { color: failed ? scene.danger : scene.primary }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  button: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center' },
  confirm: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 12 },
});

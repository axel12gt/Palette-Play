import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteRankingProfile, registerPlayer, setAuthTokenGetter, type PlayerIdentity } from '@workspace/api-client-react';

const KEY = 'color-sudoku.player.v1';
const PRIVACY_KEY = 'color-sudoku.ranking-privacy.v1';
export type RankingPrivacy = 'active' | 'deleting' | 'deleted';
let identity: PlayerIdentity | null = null;
let pending: Promise<PlayerIdentity> | null = null;
let blocked = false;
setAuthTokenGetter(() => identity?.token ?? null);

export async function rankingPrivacy(): Promise<RankingPrivacy> {
  const value = await AsyncStorage.getItem(PRIVACY_KEY);
  const state = value === 'deleting' || value === 'deleted' ? value : 'active';
  blocked = state !== 'active';
  return state;
}

async function savedPlayer(): Promise<PlayerIdentity | null> {
  const stored = await AsyncStorage.getItem(KEY);
  if (!stored) return null;
  const value = JSON.parse(stored);
  if (typeof value.id !== 'string' || typeof value.name !== 'string' ||
      typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)) {
    throw new Error('Saved player identity is damaged. Your offline game is still available.');
  }
  return value;
}

export function ensurePlayer(): Promise<PlayerIdentity> {
  if (pending) return pending;
  pending = (async () => {
    if (await rankingPrivacy() !== 'active') {
      throw new Error('Online rankings are off. Open Add-ons → Privacy to enable them or finish deletion.');
    }
    if (identity) return identity;
    const stored = await savedPlayer();
    if (stored) {
      identity = stored;
    } else {
      const player = await registerPlayer();
      // Do not start ranked play unless the identity was saved successfully.
      await AsyncStorage.setItem(KEY, JSON.stringify(player));
      identity = player;
    }
    return identity!;
  })().finally(() => { pending = null; });
  return pending;
}

export async function deleteOnlineRankingProfile(): Promise<void> {
  // Wait for a previous registration before recording the deletion intent.
  if (pending) await pending.catch(() => undefined);
  blocked = true;
  await AsyncStorage.setItem(PRIVACY_KEY, 'deleting');
  const player = identity ?? await savedPlayer();
  if (player) {
    // Use the saved token explicitly: deletion must work after an app restart,
    // without registering a replacement identity.
    await deleteRankingProfile({ headers: { Authorization: `Bearer ${player.token}` } });
  }
  await AsyncStorage.setItem(PRIVACY_KEY, 'deleted');
  await AsyncStorage.removeItem(KEY);
  identity = null;
}

export async function enableOnlineRankings(): Promise<void> {
  const state = await rankingPrivacy();
  if (state === 'active') return;
  if (state === 'deleting') {
    throw new Error('Finish deleting your previous online profile before enabling rankings.');
  }
  // Remove any leftover credential after a partially completed local cleanup.
  await AsyncStorage.removeItem(KEY);
  identity = null;
  await AsyncStorage.setItem(PRIVACY_KEY, 'active');
  blocked = false;
}

export function onlineRankingsBlocked(): boolean { return blocked; }

import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPlayer, setAuthTokenGetter, type PlayerIdentity } from '@workspace/api-client-react';

const KEY = 'color-sudoku.player.v1';
let identity: PlayerIdentity | null = null;
let pending: Promise<PlayerIdentity> | null = null;
setAuthTokenGetter(() => identity?.token ?? null);

export function ensurePlayer(): Promise<PlayerIdentity> {
  if (identity) return Promise.resolve(identity);
  if (pending) return pending;
  pending = (async () => {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      const value = JSON.parse(stored);
      if (typeof value.id !== 'string' || typeof value.name !== 'string' ||
          typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)) {
        throw new Error('Saved player identity is damaged. Your offline game is still available.');
      }
      identity = value;
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

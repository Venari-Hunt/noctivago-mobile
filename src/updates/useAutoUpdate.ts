import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// Over-the-air updates (EAS Update, channel "spike"): the native launch check
// downloads new code; this also checks whenever the app comes back to the
// front, and restarts into a downloaded update unless audio is playing.
export function useAutoUpdate(playing: boolean) {
  const { currentlyRunning, isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline or rate limited: the next launch checks again.
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isUpdatePending && !playing) Updates.reloadAsync().catch(() => {});
  }, [isUpdatePending, playing]);

  const version = Constants.expoConfig?.version ?? '?';
  const source = currentlyRunning.isEmbeddedLaunch
    ? 'built-in code'
    : `update ${currentlyRunning.createdAt?.toLocaleString() ?? currentlyRunning.updateId?.slice(0, 8)}`;
  return { label: `v${version} · ${source}`, updateWaiting: isUpdatePending && playing };
}

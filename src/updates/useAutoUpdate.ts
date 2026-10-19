import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Over-the-air updates (EAS Update, channel "spike"): the native launch check
// downloads new code; this also checks whenever the app comes back to the
// front, and restarts into a downloaded update unless audio is playing or
// "Install updates automatically" is off (then Settings offers a restart).
export function useAutoUpdate(playing: boolean, autoInstall: boolean) {
  const { currentlyRunning, isUpdatePending } = Updates.useUpdates();
  const [status, setStatus] = useState<string | null>(null);

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
    if (isUpdatePending && !playing && autoInstall) Updates.reloadAsync().catch(() => {});
  }, [isUpdatePending, playing, autoInstall]);

  const checkNow = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      setStatus('Updates are off in this build');
      return;
    }
    setStatus('Checking…');
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setStatus('You have the latest version');
        return;
      }
      setStatus('Downloading…');
      await Updates.fetchUpdateAsync();
      setStatus(null); // `pending` takes over
    } catch (e) {
      setStatus(`Couldn't check: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const version = Constants.expoConfig?.version ?? '?';
  const source = currentlyRunning.isEmbeddedLaunch
    ? 'built-in code'
    : `update ${currentlyRunning.createdAt?.toLocaleString() ?? currentlyRunning.updateId?.slice(0, 8)}`;
  let waiting: string | null = null;
  if (isUpdatePending && playing) waiting = 'new version ready, pause to load it';
  else if (isUpdatePending && !autoInstall) waiting = 'new version ready, restart in Settings';
  return {
    label: `v${version} · ${source}`,
    /** Why a downloaded update is not loading by itself, or null. */
    waiting,
    pending: isUpdatePending,
    status,
    checkNow,
    restart: () => Updates.reloadAsync().catch(() => {}),
  };
}

export type UpdateState = ReturnType<typeof useAutoUpdate>;

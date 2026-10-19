import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { type AppSettings, parseSettings } from './domain/settings';

// One settings file in app storage, read once and kept in memory. Screens
// read it with useSettings() and re-render when it changes.

const file = () => new File(Paths.document, 'settings.json');

function load(): AppSettings {
  try {
    const f = file();
    return parseSettings(f.exists ? JSON.parse(f.textSync()) : null);
  } catch {
    return parseSettings(null);
  }
}

let current: AppSettings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): AppSettings {
  current ??= load();
  return current;
}

export function setSettings(change: Partial<AppSettings>) {
  current = { ...getSettings(), ...change };
  try {
    file().writeSync(JSON.stringify(current));
  } catch {
    // Kept for this session; the next change tries to save again.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings);
}

// App settings: what they are, their defaults, and how a saved file is read
// back (anything missing or broken falls back to the default).

export type AppSettings = {
  /** Restart into a downloaded update by itself (never while playing). */
  autoInstallUpdates: boolean;
  /** How long the sleep timer fades to silence. */
  sleepFadeSeconds: number;
  /** Minutes of a timer started on every Play, or 0 for none. */
  sleepAutoMinutes: number;
  /** Volume of a sound added to a mix, 0-1. */
  newSoundVolume: number;
  /** Phone versions of the PC's core plugins; off hides them. */
  browseSounds: boolean;
  community: boolean;
  /** The player's "Audio kept running… · battery" line, for overnight tests. */
  showPlaybackCheck: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  autoInstallUpdates: true,
  sleepFadeSeconds: 30,
  sleepAutoMinutes: 0,
  newSoundVolume: 0.7,
  browseSounds: true,
  community: true,
  showPlaybackCheck: false,
};

export const FADE_CHOICES = [10, 30, 60, 300];

/** Same choices as the player's sleep timer, plus 0 = off. */
export const AUTO_SLEEP_CHOICES = [0, 15, 30, 45, 60, 90, 120];

export function fadeLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
}

export function parseSettings(raw: unknown): AppSettings {
  const bag = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const bool = (key: keyof AppSettings) =>
    typeof bag[key] === 'boolean' ? (bag[key] as boolean) : (DEFAULT_SETTINGS[key] as boolean);
  const oneOf = (key: keyof AppSettings, choices: number[]) =>
    choices.includes(bag[key] as number) ? (bag[key] as number) : (DEFAULT_SETTINGS[key] as number);
  const volume = bag.newSoundVolume;
  return {
    autoInstallUpdates: bool('autoInstallUpdates'),
    sleepFadeSeconds: oneOf('sleepFadeSeconds', FADE_CHOICES),
    sleepAutoMinutes: oneOf('sleepAutoMinutes', AUTO_SLEEP_CHOICES),
    newSoundVolume:
      typeof volume === 'number' && Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_SETTINGS.newSoundVolume,
    browseSounds: bool('browseSounds'),
    community: bool('community'),
    showPlaybackCheck: bool('showPlaybackCheck'),
  };
}

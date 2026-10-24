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
  /** The soft limiter that bends peaks past -1 dB. Off passes the mix as is (the phone's output clips at 0 dB). Read when a mix opens. */
  softLimiter: boolean;
  /** The player lists sounds under their Sound Groups (the PC's Group by: Sound Group). */
  groupBySoundGroup: boolean;
  /** A level bar on every sound card while playing (the player's Troubleshooting panel). */
  soundMeters: boolean;
  /** The first-launch welcome was shown (it only shows when there are no mixes yet). */
  welcomeSeen: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  autoInstallUpdates: true,
  sleepFadeSeconds: 30,
  sleepAutoMinutes: 0,
  newSoundVolume: 0.7,
  browseSounds: true,
  community: true,
  showPlaybackCheck: false,
  softLimiter: true,
  groupBySoundGroup: false,
  soundMeters: false,
  welcomeSeen: false,
};

export const FADE_CHOICES = [10, 30, 60, 300];

/** Same choices as the player's sleep timer, plus 0 = off. */
export const AUTO_SLEEP_CHOICES = [0, 15, 30, 45, 60, 90, 120];

export function fadeLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
}

/** A backup file's text as settings, or null when it is not a settings file.
 * Unknown or broken values fall back to their defaults. */
export function parseSettingsFile(text: string): AppSettings | null {
  try {
    const raw: unknown = JSON.parse(text);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? parseSettings(raw) : null;
  } catch {
    return null;
  }
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
    softLimiter: bool('softLimiter'),
    groupBySoundGroup: bool('groupBySoundGroup'),
    soundMeters: bool('soundMeters'),
    welcomeSeen: bool('welcomeSeen'),
  };
}

// Rules for recording a sound with the phone's microphone (no audio code here).

/** A recording stops by itself at this length, so a forgotten one can't fill the phone. */
export const MAX_RECORDING_SECONDS = 60 * 60;

/** Shorter than this is a mis-tap, not a sound worth keeping. */
export const MIN_RECORDING_SECONDS = 0.5;

/** The name a recording gets when you leave the field empty: "Recording 2026-10-19 21:05". */
export function defaultRecordingName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Recording ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** The file name a recording is stored under: the name typed (or the default) plus .m4a. */
export function recordingFileName(typed: string, now: Date): string {
  const name = typed.trim().replace(/[\\/]+/g, ' ').trim() || defaultRecordingName(now);
  return `${name}.m4a`;
}

/** 0 → "0:00", 75.4 → "1:15": the running clock while recording. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export type MicPermission = 'Undetermined' | 'Denied' | 'Granted';

/** What to say when the microphone can't be used; null when it can. */
export function permissionProblem(status: MicPermission): string | null {
  if (status === 'Granted') return null;
  return 'Noctívago needs the microphone to record. Allow it in Android Settings → Apps → Noctívago → Permissions, then try again.';
}

import { normalizeTime } from './shotEdit.ts';

// Sleep timer rules. The engine schedules the fade on the audio clock, since
// JS timers stall while the screen is off; these are just the numbers.

/** Same choices as the desktop's sleep timer modal. */
export const SLEEP_PRESET_MINUTES = [15, 30, 45, 60, 90, 120];

const FADE_SECONDS = 30;

export function presetLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// When to start fading and when the fade reaches silence, in seconds from
// now. Short timers fade over their second half.
export function fadePlan(seconds: number, fadeSeconds = FADE_SECONDS): { fadeStart: number; end: number } {
  const fade = Math.min(fadeSeconds, seconds / 2);
  return { fadeStart: seconds - fade, end: seconds };
}

// Milliseconds left -> "1:05:09" / "29:41" / "0:07".
export function countdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// The player's timer button: "Timer" while off, else the time left.
export function timerButtonLabel(msLeft: number | null): string {
  return msLeft === null ? 'Timer' : countdown(msLeft);
}

/** Whole minutes from `now` to the next time the clock reads `text` (24 h,
 * like "6:30"); a time that already passed today means tomorrow. Null when
 * `text` isn't a time. */
export function minutesUntilClock(text: string, now: Date = new Date()): number | null {
  const time = normalizeTime(text);
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
}

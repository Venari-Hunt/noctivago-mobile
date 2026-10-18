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
export function fadePlan(seconds: number): { fadeStart: number; end: number } {
  const fade = Math.min(FADE_SECONDS, seconds / 2);
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

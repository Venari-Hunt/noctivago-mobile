// The night log: one JSON line every 10 minutes of playback (and on play,
// pause and sleep timer end), saved in app storage so an overnight test
// needs nobody watching. The app prints it to Android's log on start
// (`[nightlog]` lines); `scripts/night-report.mjs` turns it into a summary.
// Pure, so `npm test` can load it.

export type NightEntry = {
  kind: 'load' | 'play' | 'pause' | 'sleep-end' | 'tick';
  wallMs: number;
  audioSec: number;
  preset: string;
  /** 0-1, or null when Android won't say. */
  battery: number | null;
  charging: boolean | null;
  /** JavaScript heap in MB (Hermes), or null. */
  jsHeapMb: number | null;
  /** Per shot sound: [shots planned, safety re-books] since load. */
  shots: Record<string, [number, number]>;
};

export const NIGHT_LOG_MAX_LINES = 1000; // ~6 nights of ticks

export function appendCapped(text: string, line: string, maxLines = NIGHT_LOG_MAX_LINES): string {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  lines.push(line);
  return lines.slice(-maxLines).join('\n') + '\n';
}

export function parseNightLog(text: string): NightEntry[] {
  const out: NightEntry[] = [];
  for (const line of text.split('\n')) {
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry.wallMs === 'number') out.push(entry);
    } catch {
      // a cut or foreign line
    }
  }
  return out;
}

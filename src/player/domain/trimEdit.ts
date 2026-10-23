// Trimming a sound on the phone: where its clip starts and ends. Same fields
// as the desktop's Remix (`settings.loopStart` / `loopEnd`, in seconds of the
// clip), so a shared mix keeps the trim on the PC. A desktop phone export
// bakes its clips and writes loopStart 0 / loopEnd = clip length, so those
// play whole; only a trim set here (or one the PC left in) cuts anything.
// Pure, so `npm test` can load it.
import type { PhonePreset } from './presetFile.ts';

type Bag = Record<string, unknown>;

/** The shortest clip a trim may leave. */
export const MIN_TRIM_SECONDS = 0.1;
// A decoded clip can differ from its stated length by a few milliseconds.
const WHOLE_TOLERANCE_SECONDS = 0.1;

function rawSettings(manifest: Bag, index: number): Bag {
  const raw = Array.isArray(manifest.sounds) ? (manifest.sounds as Bag[])[index] : null;
  const settings = raw?.settings;
  return settings && typeof settings === 'object' ? (settings as Bag) : {};
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The trim to show for a clip `duration` seconds long (0 to the end if none). */
export function trimOf(manifest: Bag, index: number, duration: number): { start: number; end: number } {
  const s = rawSettings(manifest, index);
  const start = Math.min(Math.max(0, num(s.loopStart) ?? 0), Math.max(0, duration - MIN_TRIM_SECONDS));
  const end = Math.min(duration, Math.max(start + MIN_TRIM_SECONDS, num(s.loopEnd) ?? duration));
  return { start, end };
}

/** Sets the start and/or end (seconds); they keep at least MIN_TRIM_SECONDS apart. */
export function setTrim<T extends PhonePreset>(preset: T, index: number, duration: number, patch: { start?: number; end?: number }): T {
  if (!preset.sounds[index]) return preset;
  const now = trimOf(preset.manifest, index, duration);
  let start = Math.max(0, patch.start ?? now.start);
  let end = Math.min(duration, patch.end ?? now.end);
  if (patch.start !== undefined) start = Math.min(start, end - MIN_TRIM_SECONDS);
  else end = Math.max(end, start + MIN_TRIM_SECONDS);
  start = Math.max(0, start);
  const sounds = Array.isArray(preset.manifest.sounds) ? (preset.manifest.sounds as Bag[]) : [];
  return {
    ...preset,
    manifest: {
      ...preset.manifest,
      sounds: sounds.map((s, i) =>
        i === index ? { ...s, settings: { ...rawSettings(preset.manifest, index), loopStart: start, loopEnd: end } } : s,
      ),
    },
  };
}

/** The sample range to keep from a decoded clip, or null when it plays whole. */
export function trimFrames(
  manifest: Bag,
  index: number,
  sampleRate: number,
  length: number,
): { start: number; end: number } | null {
  const s = rawSettings(manifest, index);
  const loopStart = num(s.loopStart);
  const loopEnd = num(s.loopEnd);
  if (loopStart === null && loopEnd === null) return null;
  const duration = length / sampleRate;
  const { start, end } = trimOf(manifest, index, duration);
  if (start <= WHOLE_TOLERANCE_SECONDS && end >= duration - WHOLE_TOLERANCE_SECONDS) return null;
  const from = Math.max(0, Math.round(start * sampleRate));
  const to = Math.min(length, Math.round(end * sampleRate));
  return to - from >= 1 ? { start: from, end: to } : null;
}

/** "1:05.3" / "12.0 s": a point in a clip for people. */
export function clipTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)} s`;
}

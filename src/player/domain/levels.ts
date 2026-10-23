// Reading how loud the mix is and what to do when it is too loud. The mix
// passes through a soft limiter (mixPlan.softClipCurve) that starts bending at
// -1 dBFS; when peaks go past that, the limiter squashes everything under
// them, which sounds like the other sounds ducking on a loud one (thunder).
// This is what the level strip measures, before the limiter. Pure, so
// `npm test` can load it.
import type { PhonePreset } from './presetFile.ts';

/** Peak amplitude (1 = 0 dBFS) where the limiter starts to act: -1 dBFS. */
export const CLIP_THRESHOLD = 0.891;

/** Quietest level shown, in dB. */
export const FLOOR_DB = -60;

export function peakOf(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

export function toDb(amplitude: number): number {
  return amplitude <= 0 ? FLOOR_DB : Math.max(FLOOR_DB, 20 * Math.log10(amplitude));
}

export const isClipping = (peak: number) => peak > CLIP_THRESHOLD;

/** A signed dB text: "-6.2 dB", "+1.4 dB", "silent". */
export function dbText(db: number): string {
  if (db <= FLOOR_DB) return 'silent';
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

/** How many dB to lower every sound so a peak of `peakDb` ends near -2 dB
 * (a little under the limiter), in half-dB steps, 1 to 12. */
export function suggestedLowerDb(peakDb: number): number {
  return Math.min(12, Math.max(1, Math.ceil((peakDb + 2) * 2) / 2));
}

/** Every sound's volume lowered by `db` (the PC's "lower every sound equally"). */
export function lowerAllVolumes<T extends PhonePreset>(preset: T, db: number): T {
  const factor = Math.pow(10, -Math.abs(db) / 20);
  return { ...preset, sounds: preset.sounds.map((s) => ({ ...s, volume: s.volume * factor })) };
}

/** The latched clip state: the worst peak seen and which groups were hot. */
export type ClipLatch = { peak: number; hotGroups: number[] };

/** Folds one reading into the latch. `groupPeaks[g]` is group g's peak (0 if none). */
export function latchClip(latch: ClipLatch | null, mix: number, groupPeaks: number[]): ClipLatch | null {
  const hot = groupPeaks.flatMap((p, g) => (isClipping(p) ? [g] : []));
  if (!isClipping(mix) && hot.length === 0) return latch;
  const hotGroups = [...new Set([...(latch?.hotGroups ?? []), ...hot])].sort((a, b) => a - b);
  return { peak: Math.max(latch?.peak ?? 0, mix, ...groupPeaks), hotGroups };
}

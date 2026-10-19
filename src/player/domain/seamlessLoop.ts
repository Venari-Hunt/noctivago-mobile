// Seamless loops for your own sounds: the desktop's "overlapping tail
// crossfade" (../noctivago/src/main/ffmpeg/loopClip.js), done on the decoded
// samples instead of with ffmpeg. Cut the clip at its middle M into A and B,
// play B first, then A, and blend the clip's end into its start under an
// equal-power crossfade:
//
//   B body [M, E-f)  |  tail [E-f, E) x head [0, f)  |  A body [f, M)
//
// It starts and ends on source sample M (one continuous recording), so the
// wrap needs no blend, and the only edit sits in the middle under the fade.
// The loop is `f` samples shorter than the clip.
//
// Which sounds: a desktop phone export bakes its clips and sets
// `crossfadeSeconds: 0`, so they loop plainly. A sound added on the phone has
// no crossfade setting, which the desktop reads as its default 0.2 s, so the
// phone does the same and a shared mix sounds alike on both.
// Pure, so `npm test` can load it.

export const DEFAULT_CROSSFADE_SECONDS = 0.2;

/** Seconds of crossfade a loop sound asks for (0 = loop plainly). */
export function loopFadeSeconds(settings: unknown, durationSeconds: number): number {
  const requested = (settings as { crossfadeSeconds?: unknown } | null)?.crossfadeSeconds;
  const fade = typeof requested === 'number' && Number.isFinite(requested) ? requested : DEFAULT_CROSSFADE_SECONDS;
  // Like the desktop: never more than a quarter of the clip.
  return Math.max(0, Math.min(fade, durationSeconds / 4));
}

export type SeamlessPlan = { fadeFrames: number; mid: number; outLength: number };

/** Where to cut a clip of `length` samples; null when there is nothing to blend. */
export function seamlessPlan(length: number, sampleRate: number, fadeSeconds: number): SeamlessPlan | null {
  const fadeFrames = Math.min(Math.round(fadeSeconds * sampleRate), Math.floor(length / 4));
  if (fadeFrames < 1) return null;
  return { fadeFrames, mid: Math.floor(length / 2), outLength: length - fadeFrames };
}

/** Writes one channel's seamless loop from `src` into `out` (plan.outLength long). */
export function writeSeamless(src: Float32Array, out: Float32Array, { fadeFrames: f, mid }: SeamlessPlan) {
  const end = src.length;
  const bodyB = end - f - mid;
  out.set(src.subarray(mid, end - f), 0);
  for (let i = 0; i < f; i++) {
    const t = (i / f) * (Math.PI / 2);
    out[bodyB + i] = src[end - f + i] * Math.cos(t) + src[i] * Math.sin(t);
  }
  out.set(src.subarray(f, mid), bodyB + f);
}

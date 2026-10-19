// What a phone preset asks the live mix for, beyond each sound's baked clip:
// Sound Group and whole-mix filters, and which drift settings each sound and
// bus actually runs (the desktop's group rules, src/shared/groupDrift.js).
// Contract: ../noctivago/docs/mobile.md, "Phone preset file". Pure, so
// `npm test` can load it.
import { eqBandStageCount, eqNodeType } from '../../shared/eqBands.js';
import { applyGroupShotOverride, busFluctuation, effectiveMemberFluctuation } from '../../shared/groupDrift.js';
import { loopFadeSeconds } from './seamlessLoop.ts';

type Bag = Record<string, unknown>;

export type BiquadStage = { type: string; frequency: number; Q: number; gain: number };

/** A Sound Group or the whole mix, as the phone builds it. */
export type BusSpec = {
  /** Highpass, lowpass and EQ stages, in desktop order; no-op stages left out. */
  stages: BiquadStage[];
  /** Linear gain. */
  gain: number;
  /** Echo as fixed repeats: the phone's audio library can't run the
   * desktop's feedback loop, so repeat k plays k delays later at decay^k. */
  echo: { delaySeconds: number; taps: number[] } | null;
  /** Bus drift: volume (and pan, for a group). */
  drift: { volume?: unknown; pan?: unknown };
};

// Repeats stop once they are 60 dB down, or after this many.
const MAX_ECHO_TAPS = 16;
const ECHO_FLOOR = 0.001;
const MAX_ECHO_DELAY_SECONDS = 2;
const GAIN_SHAPED = ['peaking', 'lowshelf', 'highshelf'];

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function sounds(manifest: Bag): Bag[] {
  return Array.isArray(manifest.sounds) ? (manifest.sounds as Bag[]) : [];
}

function groups(manifest: Bag): { filters: Bag | null; soundIndexes: number[] }[] {
  if (!Array.isArray(manifest.groups)) return [];
  return (manifest.groups as Bag[]).map((g) => ({
    filters: g?.filters && typeof g.filters === 'object' ? (g.filters as Bag) : null,
    soundIndexes: Array.isArray(g?.soundIndexes) ? (g.soundIndexes as number[]) : [],
  }));
}

/** The group sound `index` plays through (the first one listing it, like
 * the desktop Mixer), or -1. */
export function groupIndexOf(manifest: Bag, index: number): number {
  return groups(manifest).findIndex((g) => g.soundIndexes.includes(index));
}

function groupFluctuation(manifest: Bag, index: number): Bag | null {
  const g = groups(manifest)[groupIndexOf(manifest, index)];
  return (g?.filters?.fluctuation as Bag | undefined) ?? null;
}

function settingsOf(manifest: Bag, index: number): Bag {
  return (sounds(manifest)[index]?.settings as Bag | undefined) ?? {};
}

/** A looping sound's own drift, after its group's rules. */
export function soundFluctuation(manifest: Bag, index: number): Bag | null {
  return effectiveMemberFluctuation(settingsOf(manifest, index).fluctuation ?? null, groupFluctuation(manifest, index));
}

/** A looping sound's seam crossfade in seconds (seamlessLoop.ts); 0 for desktop exports. */
export function loopFade(manifest: Bag, index: number, durationSeconds: number): number {
  return loopFadeSeconds(settingsOf(manifest, index), durationSeconds);
}

/** A Random Interval / Scheduled sound's live config, after its group's rules. */
export function shotSettings(manifest: Bag, index: number, mode: 'scatter' | 'scheduled'): Bag {
  const settings = settingsOf(manifest, index);
  const config = mode === 'scatter' ? settings.scatter : settings.schedule;
  const own = config && typeof config === 'object' ? (config as Bag) : {};
  return applyGroupShotOverride(own, groupFluctuation(manifest, index)) ?? {};
}

export function groupBusSpecs(manifest: Bag): (BusSpec | null)[] {
  return groups(manifest).map((g) => busSpec(g.filters, busFluctuation(g.filters?.fluctuation ?? null) ?? {}));
}

export function wholeMixSpec(manifest: Bag): BusSpec | null {
  const filters = manifest.wholeMix && typeof manifest.wholeMix === 'object' ? (manifest.wholeMix as Bag) : null;
  // The whole mix drifts in volume only (desktop WholeMixChain).
  const volume = (filters?.fluctuation as Bag | undefined)?.volume;
  return busSpec(filters, volume ? { volume } : {});
}

/** Seconds the first Play fades in over (the desktop's on-load fade). */
export function wholeMixFadeIn(manifest: Bag): number {
  return Math.max(0, num((manifest.wholeMix as Bag | undefined)?.fadeInSeconds, 0));
}

// Null when the bus would change nothing, so the phone builds no nodes.
export function busSpec(filters: Bag | null, drift: BusSpec['drift']): BusSpec | null {
  const f = filters ?? {};
  const stages: BiquadStage[] = [];
  const highpass = num(f.highpassHz, 0);
  if (highpass > 0) stages.push({ type: 'highpass', frequency: highpass, Q: 1, gain: 0 });
  const lowpass = num(f.lowpassHz, 20000);
  if (lowpass < 20000) stages.push({ type: 'lowpass', frequency: lowpass, Q: 1, gain: 0 });
  for (const band of Array.isArray(f.eq) ? (f.eq as Bag[]) : []) {
    const type = eqNodeType(band);
    const gain = num(band.gainDb, 0);
    if (type === 'allpass' || (GAIN_SHAPED.includes(type) && gain === 0)) continue;
    const stage = { type, frequency: num(band.freqHz, 1000), Q: num(band.q, 1), gain };
    for (let i = 0; i < eqBandStageCount(band); i++) stages.push({ ...stage });
  }
  const gainDb = num(f.gainDb, 0);
  const echo = echoTaps(num(f.echoDelayMs, 0) / 1000, num(f.echoDecay, 0));
  const hasDrift = Object.values(drift).some((a) => (a as Bag | undefined)?.enabled);
  if (stages.length === 0 && gainDb === 0 && !echo && !hasDrift) return null;
  return { stages, gain: gainDb ? Math.pow(10, gainDb / 20) : 1, echo, drift };
}

export function echoTaps(delaySeconds: number, decay: number): BusSpec['echo'] {
  const delay = Math.min(MAX_ECHO_DELAY_SECONDS, delaySeconds);
  const d = Math.min(0.99, decay);
  if (delay <= 0 || d <= 0) return null;
  const taps: number[] = [];
  for (let g = d; g >= ECHO_FLOOR && taps.length < MAX_ECHO_TAPS; g *= d) taps.push(g);
  return { delaySeconds: delay, taps };
}

// Soft ceiling standing in for the desktop's brick-wall limiter (the phone's
// audio library has no compressor): untouched below -1 dBFS, then bends
// smoothly toward 0.95, the export's limit.
export const CLIP_RANGE = 4; // the curve covers -4..4 (the shaper's input is scaled down)
const CLIP_KNEE = 0.891;
const CLIP_CEILING = 0.95;

export function softClipCurve(points = 8193): Float32Array {
  const curve = new Float32Array(points);
  const room = CLIP_CEILING - CLIP_KNEE;
  for (let i = 0; i < points; i++) {
    const x = CLIP_RANGE * ((2 * i) / (points - 1) - 1);
    const a = Math.abs(x);
    curve[i] = a <= CLIP_KNEE ? x : Math.sign(x) * (CLIP_KNEE + room * Math.tanh((a - CLIP_KNEE) / room));
  }
  return curve;
}

// Choosing a sound's play mode and programming its Random Interval (scatter)
// or Scheduled settings on the phone. Same fields the desktop's Remix writes
// into a sound's `settings` (`playMode`, `scatter`, `schedule`; see
// src/shared/shotRules.js), so a shared mix keeps them on the PC. Pure, so
// `npm test` can load it.
import type { PhonePreset, PlayMode } from './presetFile.ts';

type Bag = Record<string, unknown>;

// shotRules.js defaults for a scatter with no gap set.
export const DEFAULT_MIN_GAP = 5;
export const DEFAULT_MAX_GAP = 35;
export const DEFAULT_INTERVAL_MINUTES = 60;

export type ScatterGap = { min: number; max: number; fullyRandom: boolean };
export type Schedule = { type: 'times' | 'interval'; times: string[]; intervalMinutes: number };

function rawSettings(preset: PhonePreset, index: number): Bag {
  const raw = Array.isArray(preset.manifest.sounds) ? (preset.manifest.sounds as Bag[])[index] : null;
  const settings = raw?.settings;
  return settings && typeof settings === 'object' ? (settings as Bag) : {};
}

// Writes `patch` into sound `index`'s settings, in both the typed list the
// player reads and the manifest a shared mix carries.
function withSettings<T extends PhonePreset>(preset: T, index: number, patch: Bag, playMode?: PlayMode): T {
  if (!preset.sounds[index]) return preset;
  const sounds = Array.isArray(preset.manifest.sounds) ? (preset.manifest.sounds as Bag[]) : [];
  return {
    ...preset,
    sounds: preset.sounds.map((s, i) => (i === index && playMode ? { ...s, playMode } : s)),
    manifest: {
      ...preset.manifest,
      sounds: sounds.map((s, i) =>
        i === index ? { ...s, settings: { ...rawSettings(preset, index), ...patch, ...(playMode ? { playMode } : {}) } } : s,
      ),
    },
  };
}

export function setPlayMode<T extends PhonePreset>(preset: T, index: number, mode: PlayMode): T {
  return withSettings(preset, index, {}, mode);
}

function objectAt(preset: PhonePreset, index: number, key: 'scatter' | 'schedule'): Bag {
  const v = rawSettings(preset, index)[key];
  return v && typeof v === 'object' ? (v as Bag) : {};
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function scatterGap(preset: PhonePreset, index: number): ScatterGap {
  const s = objectAt(preset, index, 'scatter');
  const min = Math.max(0, num(s.minGapSeconds, DEFAULT_MIN_GAP));
  return { min, max: Math.max(min, num(s.maxGapSeconds, DEFAULT_MAX_GAP)), fullyRandom: Boolean(s.gapFullyRandom) };
}

/** Sets the gap between shots; the max never drops below the min. */
export function setScatterGap<T extends PhonePreset>(preset: T, index: number, gap: Partial<ScatterGap>): T {
  const now = scatterGap(preset, index);
  const min = Math.max(0, gap.min ?? now.min);
  const max = Math.max(min, gap.max ?? now.max);
  const next = { ...objectAt(preset, index, 'scatter'), minGapSeconds: min, maxGapSeconds: max, gapFullyRandom: gap.fullyRandom ?? now.fullyRandom };
  return withSettings(preset, index, { scatter: next });
}

/** "6:5" or "06:05" → "06:05"; anything that isn't a 24 h time → null. */
export function normalizeTime(text: string): string | null {
  const m = /^\s*(\d{1,2})\s*[:h.]\s*(\d{1,2})\s*$/.exec(text);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function scheduleOf(preset: PhonePreset, index: number): Schedule {
  const s = objectAt(preset, index, 'schedule');
  const times = Array.isArray(s.times) ? (s.times as unknown[]).filter((t): t is string => typeof t === 'string') : [];
  return {
    type: s.type === 'interval' ? 'interval' : 'times',
    times: [...times].sort(),
    intervalMinutes: Math.max(1, num(s.intervalMinutes, DEFAULT_INTERVAL_MINUTES)),
  };
}

export function setSchedule<T extends PhonePreset>(preset: T, index: number, patch: Partial<Schedule>): T {
  const now = scheduleOf(preset, index);
  const next = {
    ...objectAt(preset, index, 'schedule'),
    type: patch.type ?? now.type,
    times: [...(patch.times ?? now.times)].sort(),
    intervalMinutes: Math.max(1, patch.intervalMinutes ?? now.intervalMinutes),
  };
  return withSettings(preset, index, { schedule: next });
}

/** Adds a daily time (no duplicates); null when `text` isn't a time. */
export function addScheduleTime<T extends PhonePreset>(preset: T, index: number, text: string): T | null {
  const time = normalizeTime(text);
  if (!time) return null;
  const { times } = scheduleOf(preset, index);
  return times.includes(time) ? preset : setSchedule(preset, index, { times: [...times, time] });
}

export function removeScheduleTime<T extends PhonePreset>(preset: T, index: number, time: string): T {
  return setSchedule(preset, index, { times: scheduleOf(preset, index).times.filter((t) => t !== time) });
}

/** "5 s", "90 s", "2 min", "1 h 30 min": a gap or interval for people. */
export function durationText(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 120) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 120) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

// What each play of a Random Interval or Scheduled sound varies: the same
// four axes and bounds as the desktop Remix, stored on whichever of
// `scatter` / `schedule` the sound uses (shotRules.js reads both alike).
export type ShotMode = 'scatter' | 'scheduled';
export type PlayAxis = 'volume' | 'pitch' | 'pan' | 'speed';
export type PerPlay = { min: number; max: number; fullyRandom: boolean };

export const PLAY_AXES: Record<PlayAxis, { min: number; max: number; neutral: number; step: number; keys: [string, string, string] }> = {
  volume: { min: 0, max: 1, neutral: 1, step: 0.01, keys: ['minVolume', 'maxVolume', 'volumeFullyRandom'] },
  pitch: { min: -12, max: 12, neutral: 0, step: 1, keys: ['minPitchSemitones', 'maxPitchSemitones', 'pitchFullyRandom'] },
  pan: { min: -1, max: 1, neutral: 0, step: 0.05, keys: ['minPan', 'maxPan', 'panFullyRandom'] },
  speed: { min: 0.5, max: 2, neutral: 1, step: 0.05, keys: ['minSpeed', 'maxSpeed', 'speedFullyRandom'] },
};

export const MAX_FADE_MS = 5000;

const configKey = (mode: ShotMode) => (mode === 'scatter' ? 'scatter' : 'schedule');
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function perPlay(preset: PhonePreset, index: number, mode: ShotMode, axis: PlayAxis): PerPlay {
  const a = PLAY_AXES[axis];
  const c = objectAt(preset, index, configKey(mode));
  const min = clamp(num(c[a.keys[0]], a.neutral), a.min, a.max);
  return { min, max: clamp(Math.max(min, num(c[a.keys[1]], a.neutral)), a.min, a.max), fullyRandom: Boolean(c[a.keys[2]]) };
}

/** Sets one axis; the max never drops below the min, both stay in range. */
export function setPerPlay<T extends PhonePreset>(preset: T, index: number, mode: ShotMode, axis: PlayAxis, patch: Partial<PerPlay>): T {
  const a = PLAY_AXES[axis];
  const now = perPlay(preset, index, mode, axis);
  const min = clamp(patch.min ?? now.min, a.min, a.max);
  const max = clamp(Math.max(min, patch.max ?? now.max), a.min, a.max);
  const key = configKey(mode);
  const next = { ...objectAt(preset, index, key), [a.keys[0]]: min, [a.keys[1]]: max, [a.keys[2]]: patch.fullyRandom ?? now.fullyRandom };
  return withSettings(preset, index, { [key]: next });
}

export function fadeMs(preset: PhonePreset, index: number, mode: ShotMode): { inMs: number; outMs: number } {
  const c = objectAt(preset, index, configKey(mode));
  return { inMs: clamp(num(c.fadeInMs, 0), 0, MAX_FADE_MS), outMs: clamp(num(c.fadeOutMs, 0), 0, MAX_FADE_MS) };
}

export function setFadeMs<T extends PhonePreset>(preset: T, index: number, mode: ShotMode, patch: { inMs?: number; outMs?: number }): T {
  const now = fadeMs(preset, index, mode);
  const key = configKey(mode);
  const next = {
    ...objectAt(preset, index, key),
    fadeInMs: clamp(patch.inMs ?? now.inMs, 0, MAX_FADE_MS),
    fadeOutMs: clamp(patch.outMs ?? now.outMs, 0, MAX_FADE_MS),
  };
  return withSettings(preset, index, { [key]: next });
}

/** A short summary of an axis for a folded row: "Same every time" or its range. */
export function perPlayText(axis: PlayAxis, v: PerPlay): string {
  const a = PLAY_AXES[axis];
  if (v.fullyRandom) return 'Fully random';
  if (v.min === a.neutral && v.max === a.neutral) return 'Same every time';
  return `${axisValueText(axis, v.min)} to ${axisValueText(axis, v.max)}`;
}

export function axisValueText(axis: PlayAxis, value: number): string {
  if (axis === 'volume') return `${Math.round(value * 100)}%`;
  if (axis === 'speed') return `${Math.round(value * 100)}%`;
  if (axis === 'pitch') return `${value > 0 ? '+' : ''}${value} st`;
  return Math.abs(value) < 0.005 ? 'Center' : `${value < 0 ? 'L' : 'R'} ${Math.round(Math.abs(value) * 100)}%`;
}

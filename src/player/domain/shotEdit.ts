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

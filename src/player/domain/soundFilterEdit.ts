// A sound's own filters on the phone: high-pass, low-pass, gain and echo, the
// same fields and slider ranges as the desktop's Remix (`settings.filters`)
// and as a Sound Group's (groupEdit.ts). A desktop phone export bakes these
// into the clip and writes `filters: {}`, so only what is set here plays live.
// Pure, so `npm test` can load it.
import { FILTER_RANGES, type FilterField } from './groupEdit.ts';
import type { PhonePreset } from './presetFile.ts';

type Bag = Record<string, unknown>;

export const SOUND_FILTER_FIELDS: FilterField[] = ['highpassHz', 'lowpassHz', 'gainDb', 'echoDelayMs', 'echoDecay'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function rawSettings(manifest: Bag, index: number): Bag {
  const raw = Array.isArray(manifest.sounds) ? (manifest.sounds as Bag[])[index] : null;
  const settings = raw?.settings;
  return settings && typeof settings === 'object' ? (settings as Bag) : {};
}

function filtersOf(manifest: Bag, index: number): Bag {
  const f = rawSettings(manifest, index).filters;
  return f && typeof f === 'object' ? (f as Bag) : {};
}

export function soundFilterValue(preset: PhonePreset, index: number, field: FilterField): number {
  const r = FILTER_RANGES[field];
  const v = filtersOf(preset.manifest, index)[field];
  const n = typeof v === 'number' && Number.isFinite(v) ? v : r.off;
  return clamp(n, Math.min(r.min, r.off), Math.max(r.max, r.off));
}

export function setSoundFilter<T extends PhonePreset>(preset: T, index: number, field: FilterField, value: number): T {
  if (!preset.sounds[index]) return preset;
  const r = FILTER_RANGES[field];
  const sounds = Array.isArray(preset.manifest.sounds) ? (preset.manifest.sounds as Bag[]) : [];
  const filters = { ...filtersOf(preset.manifest, index), [field]: clamp(value, r.min, r.max) };
  return {
    ...preset,
    manifest: {
      ...preset.manifest,
      sounds: sounds.map((s, i) =>
        i === index ? { ...s, settings: { ...rawSettings(preset.manifest, index), filters } } : s,
      ),
    },
  };
}

/** How many of the sound's filters are on (not at their "off" value). */
export function activeSoundFilters(preset: PhonePreset, index: number): number {
  return SOUND_FILTER_FIELDS.filter((f) => soundFilterValue(preset, index, f) !== FILTER_RANGES[f].off).length;
}

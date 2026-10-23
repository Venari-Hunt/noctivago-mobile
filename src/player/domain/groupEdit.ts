// Sound Groups on the phone: create, rename, delete, members, and the
// group's filters and drift. Same shape as the desktop's portable groups
// (`{ name, filters, soundIndexes }`, filters as the Remix plugin's Group
// mode writes them), so a shared mix keeps its groups on the PC. A sound is
// in at most one group, like the desktop Mixer. Pure, so `npm test` can load it.
import type { PhonePreset } from './presetFile.ts';
import { uniqueName, withFiles } from './mixEdit.ts';

type Bag = Record<string, unknown>;

export type Group = { name: string; filters: Bag | null; soundIndexes: number[] };

export type FilterField = 'highpassHz' | 'lowpassHz' | 'gainDb' | 'echoDelayMs' | 'echoDecay';
export type DriftAxisName = 'volume' | 'pitch' | 'pan';

/** The Remix plugin's slider ranges (FilterControls.jsx RANGES). */
export const FILTER_RANGES: Record<FilterField, { min: number; max: number; off: number }> = {
  highpassHz: { min: 0, max: 2000, off: 0 },
  lowpassHz: { min: 150, max: 20000, off: 20000 },
  gainDb: { min: -24, max: 24, off: 0 },
  echoDelayMs: { min: 0, max: 1500, off: 0 },
  echoDecay: { min: 0, max: 0.85, off: 0 },
};

/** What each drift axis can roam (modulator.js). */
export const DRIFT_RANGES: Record<DriftAxisName, { min: number; max: number }> = {
  volume: { min: 0, max: 1 },
  pitch: { min: -6, max: 6 },
  pan: { min: -1, max: 1 },
};

// The Remix plugin's defaultMixFluctuation: pitch is always "each sound on
// its own" (a bus is a sum of sounds, nothing to detune).
const TIMING = { changeMinSeconds: 6, changeMaxSeconds: 14, transitionSeconds: 8 };
const DRIFT_DEFAULTS: Record<DriftAxisName, Bag> = {
  volume: { enabled: false, fullyRandom: false, biasEnabled: true, perSound: false, min: 0.5, max: 1, bias: 0.8, ...TIMING },
  pitch: { enabled: false, fullyRandom: false, biasEnabled: true, perSound: true, min: -1, max: 1, bias: 0, ...TIMING },
  pan: { enabled: false, fullyRandom: false, biasEnabled: true, perSound: false, min: -0.5, max: 0.5, bias: 0, ...TIMING },
};

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function groupsOf(preset: PhonePreset): Group[] {
  const raw = preset.manifest.groups;
  if (!Array.isArray(raw)) return [];
  return (raw as Bag[]).map((g) => ({
    ...g,
    name: typeof g?.name === 'string' && g.name ? g.name : 'Group',
    filters: g?.filters && typeof g.filters === 'object' ? (g.filters as Bag) : null,
    soundIndexes: Array.isArray(g?.soundIndexes) ? (g.soundIndexes as number[]) : [],
  }));
}

/** The group sound `index` is in (the first listing it), or -1. */
export function groupOfSound(preset: PhonePreset, index: number): number {
  return groupsOf(preset).findIndex((g) => g.soundIndexes.includes(index));
}

function withGroups<T extends PhonePreset>(preset: T, groups: Group[]): T {
  // Files pinned so the engine's keys stay put (mixEdit.soundFile).
  const p = withFiles(preset);
  return { ...p, manifest: { ...p.manifest, groups } };
}

function without(groups: Group[], soundIndex: number): Group[] {
  return groups.map((g) => ({ ...g, soundIndexes: g.soundIndexes.filter((m) => m !== soundIndex) }));
}

/** A new, plain group at the end; `soundIndex` leaves its old group to join it. */
export function addGroup<T extends PhonePreset>(preset: T, name: string, soundIndex?: number): T {
  const groups = groupsOf(preset);
  const taken = groups.map((g) => g.name);
  const group: Group = { name: uniqueName(name.trim() || 'Group', taken), filters: null, soundIndexes: [] };
  const next = soundIndex === undefined ? groups : without(groups, soundIndex);
  if (soundIndex !== undefined) group.soundIndexes.push(soundIndex);
  return withGroups(preset, [...next, group]);
}

/** A short message for what an edit changed in the groups (null when nothing
 * a person would notice moved: filters, drift, rename). */
export function groupChangeNote(prev: PhonePreset, next: PhonePreset): string | null {
  const before = groupsOf(prev);
  const after = groupsOf(next);
  if (after.length > before.length) return `Group "${after[after.length - 1].name}" created.`;
  if (after.length < before.length) {
    const gone = before.find((g) => !after.some((a) => a.name === g.name));
    return gone ? `Group "${gone.name}" deleted. Its sounds play on their own.` : 'Group deleted.';
  }
  for (let gi = 0; gi < after.length; gi++) {
    const had = new Set(before[gi].soundIndexes);
    const has = new Set(after[gi].soundIndexes);
    const added = after[gi].soundIndexes.find((i) => !had.has(i));
    const left = before[gi].soundIndexes.find((i) => !has.has(i));
    if (added !== undefined) return `${next.sounds[added]?.name ?? 'Sound'} is now in "${after[gi].name}".`;
    if (left !== undefined) return `${next.sounds[left]?.name ?? 'Sound'} left "${before[gi].name}".`;
  }
  return null;
}

/** Puts a sound in group `gi` (leaving any other) or takes it out. */
export function setMember<T extends PhonePreset>(preset: T, gi: number, soundIndex: number, member: boolean): T {
  const groups = without(groupsOf(preset), soundIndex);
  if (member && groups[gi]) groups[gi].soundIndexes = [...groups[gi].soundIndexes, soundIndex].sort((a, b) => a - b);
  return withGroups(preset, groups);
}

export function renameGroup<T extends PhonePreset>(preset: T, gi: number, name: string): T {
  const groups = groupsOf(preset);
  if (!groups[gi] || !name.trim()) return preset;
  groups[gi] = { ...groups[gi], name: name.trim().slice(0, 80) };
  return withGroups(preset, groups);
}

/** Deletes the group; its sounds stay in the mix, playing on their own. */
export function deleteGroup<T extends PhonePreset>(preset: T, gi: number): T {
  return withGroups(preset, groupsOf(preset).filter((_, i) => i !== gi));
}

export function filterValue(group: Group, field: FilterField): number {
  const r = FILTER_RANGES[field];
  return clamp(num(group.filters?.[field], r.off), Math.min(r.min, r.off), Math.max(r.max, r.off));
}

function withFilters<T extends PhonePreset>(preset: T, gi: number, patch: (f: Bag) => Bag): T {
  const groups = groupsOf(preset);
  if (!groups[gi]) return preset;
  groups[gi] = { ...groups[gi], filters: patch({ ...(groups[gi].filters ?? {}) }) };
  return withGroups(preset, groups);
}

export function setFilter<T extends PhonePreset>(preset: T, gi: number, field: FilterField, value: number): T {
  const r = FILTER_RANGES[field];
  return withFilters(preset, gi, (f) => ({ ...f, [field]: clamp(value, r.min, r.max) }));
}

/** A group's drift axis with the desktop's defaults filled in. */
export function driftAxis(group: Group, axis: DriftAxisName): Bag {
  const saved = (group.filters?.fluctuation as Bag | undefined)?.[axis];
  const a = { ...DRIFT_DEFAULTS[axis], ...(saved && typeof saved === 'object' ? (saved as Bag) : {}) };
  return axis === 'pitch' ? { ...a, perSound: true } : a;
}

/** Edits one drift axis: on/off, together or each sound, its range. The
 * walk's resting point (bias) stays inside the range. */
export function setDrift<T extends PhonePreset>(
  preset: T,
  gi: number,
  axis: DriftAxisName,
  patch: { enabled?: boolean; perSound?: boolean; min?: number; max?: number },
): T {
  const group = groupsOf(preset)[gi];
  if (!group) return preset;
  const r = DRIFT_RANGES[axis];
  const a: Bag = { ...driftAxis(group, axis), ...patch };
  let min = clamp(num(a.min, r.min), r.min, r.max);
  let max = clamp(num(a.max, r.max), r.min, r.max);
  if (min > max) [min, max] = patch.min !== undefined ? [min, min] : [max, max];
  const next = { ...a, min, max, bias: clamp(num(a.bias, min), min, max), ...(axis === 'pitch' ? { perSound: true } : {}) };
  return withFilters(preset, gi, (f) => ({ ...f, fluctuation: { ...((f.fluctuation as Bag | undefined) ?? {}), [axis]: next } }));
}

// Frequency sliders move on a log scale (an octave is the same width
// everywhere); the far end means off. Position 0..1.
const HZ_LOW = 20;

export function hzToPosition(field: 'highpassHz' | 'lowpassHz', hz: number): number {
  const { max } = FILTER_RANGES[field];
  const lo = field === 'highpassHz' ? HZ_LOW : FILTER_RANGES.lowpassHz.min;
  if (field === 'highpassHz' && hz <= 0) return 0;
  return clamp(Math.log(Math.max(lo, hz) / lo) / Math.log(max / lo), 0, 1);
}

export function positionToHz(field: 'highpassHz' | 'lowpassHz', pos: number): number {
  const { max } = FILTER_RANGES[field];
  const lo = field === 'highpassHz' ? HZ_LOW : FILTER_RANGES.lowpassHz.min;
  if (field === 'highpassHz' && pos <= 0.005) return 0;
  if (field === 'lowpassHz' && pos >= 0.995) return max;
  const hz = lo * Math.pow(max / lo, clamp(pos, 0, 1));
  const step = hz < 100 ? 1 : hz < 1000 ? 10 : 50;
  return Math.round(hz / step) * step;
}

/** The mix's sounds laid out under their Sound Groups, like the desktop's
 * "Group by: Sound Group": sounds in no group first (the desktop calls them
 * "Playing (ungrouped)"), then each group by name with its members in mix
 * order. Empty groups are left out. */
export type Section = { key: string; title: string; groupIndex: number | null; soundIndexes: number[] };

export function sectionsOf(preset: PhonePreset): Section[] {
  const groups = groupsOf(preset);
  const grouped = new Set(groups.flatMap((g) => g.soundIndexes.filter((i) => preset.sounds[i])));
  const loose = preset.sounds.flatMap((_, i) => (grouped.has(i) ? [] : [i]));
  const out: Section[] = [];
  if (loose.length) out.push({ key: 'none', title: 'Not in a group', groupIndex: null, soundIndexes: loose });
  groups
    .map((g, gi) => ({ g, gi }))
    .sort((a, b) => a.g.name.localeCompare(b.g.name))
    .forEach(({ g, gi }) => {
      const members = g.soundIndexes.filter((i) => preset.sounds[i]).sort((a, b) => a - b);
      if (members.length) out.push({ key: `g${gi}`, title: g.name, groupIndex: gi, soundIndexes: members });
    });
  return out;
}

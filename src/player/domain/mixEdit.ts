// Building a mix on the phone: a new empty mix, adding your own sounds,
// turning one off, removing one, and the manifest a shared mix carries.
// Saved mixes keep the phone preset format (presetFile.ts), so a shared one
// imports on the desktop too. Pure, so `npm test` can load it.
import { PRESET_FORMAT, SUPPORTED_PHONE_VERSION, type PhonePreset, type PhoneSound } from './presetFile.ts';

type Bag = Record<string, unknown>;

/** The desktop's default volume for a sound added to a preset. */
export const NEW_SOUND_VOLUME = 0.7;

// What the desktop imports (its library's AUDIO_EXTENSIONS); a sound in
// another format still shares, but the desktop skips its audio.
export const DESKTOP_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'opus'];

/** The sound's audio file in its preset's audio folder. Imports before
 * 0.7.0 stored them by position ("0.ogg") and have no `file`. */
export function soundFile(sound: PhoneSound, index: number): string {
  return sound.file ?? `${index}.ogg`;
}

// Pins every sound's file before the list changes order.
export function withFiles<T extends PhonePreset>(preset: T): T {
  return { ...preset, sounds: preset.sounds.map((s, i) => ({ ...s, file: soundFile(s, i) })) };
}

export function emptyManifest(name: string): Bag {
  return {
    format: PRESET_FORMAT,
    formatVersion: 2,
    phone: { version: SUPPORTED_PHONE_VERSION },
    name,
    wholeMix: null,
    groups: [],
    sounds: [],
  };
}

function manifestSounds(manifest: Bag): Bag[] {
  return Array.isArray(manifest.sounds) ? (manifest.sounds as Bag[]) : [];
}

// "New mix", "New mix 2"…: the first name no saved mix has.
export function uniqueName(base: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let i = 2;
  while (used.has(`${base} ${i}`.toLowerCase())) i++;
  return `${base} ${i}`;
}

// A file name for a sound's audio, unique in its preset (ignoring case,
// like the desktop's bundle names). It is also the sound's file name inside
// a shared mix, so it stays readable and passes the desktop's import check
// (no path characters, no "..").
export function audioFileName(name: string, ext: string, taken: string[]): string {
  const base =
    name
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\.{2,}/g, '.')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
      .replace(/^\.+|\.+$/g, '') || 'Sound';
  const used = new Set(taken.map((t) => t.toLowerCase()));
  let candidate = `${base}.${ext}`;
  for (let i = 1; used.has(candidate.toLowerCase()); i++) candidate = `${base} (${i}).${ext}`;
  return candidate;
}

type NewSound = { name: string; fileName: string; durationSeconds: number | null; source?: object | null };

/** Adds one of your sounds at the end of the mix, as a plain loop. */
export function appendSound<T extends PhonePreset>(preset: T, sound: NewSound, file: string, volume = NEW_SOUND_VOLUME): T {
  const p = withFiles(preset);
  const entry: PhoneSound = {
    name: sound.name,
    bundleName: file,
    file,
    volume,
    playMode: 'loop',
    durationSeconds: sound.durationSeconds,
  };
  const raw: Bag = {
    name: sound.name,
    fileName: sound.fileName,
    bundleName: file,
    durationSeconds: sound.durationSeconds,
    volume,
    settings: { playMode: 'loop' },
    overrides: null,
    // The desktop's credit record (Freesound author and license), so a
    // shared mix still credits the sound.
    source: sound.source ?? null,
  };
  return { ...p, sounds: [...p.sounds, entry], manifest: { ...p.manifest, sounds: [...manifestSounds(p.manifest), raw] } };
}

/** A copy of sound `index` at the end of the mix, with all its settings. Its
 * audio is its own file (`file`), so removing either sound keeps the other.
 * The copy starts ungrouped. */
export function duplicateSoundAt<T extends PhonePreset>(preset: T, index: number, file: string): T {
  const p = withFiles(preset);
  const from = p.sounds[index];
  if (!from) return preset;
  const name = `${from.name} copy`.slice(0, 80);
  const raw = manifestSounds(p.manifest)[index] ?? {};
  return {
    ...p,
    sounds: [...p.sounds, { ...from, name, bundleName: file, file }],
    manifest: { ...p.manifest, sounds: [...manifestSounds(p.manifest), { ...raw, name, bundleName: file }] },
  };
}

/** Sound `index` of `from`, with all its settings, added at the end of
 * `target` under its own audio file (`file`). It starts ungrouped. */
export function copySoundInto<T extends PhonePreset>(target: T, from: PhonePreset, index: number, file: string): T {
  const src = withFiles(from);
  const sound = src.sounds[index];
  if (!sound) return target;
  const t = withFiles(target);
  const raw = manifestSounds(src.manifest)[index] ?? {};
  return {
    ...t,
    sounds: [...t.sounds, { ...sound, bundleName: file, file }],
    manifest: { ...t.manifest, sounds: [...manifestSounds(t.manifest), { ...raw, bundleName: file }] },
  };
}

/** Index of the first sound in the mix with this name, or -1. */
export function soundIndexByName(preset: PhonePreset, name: string): number {
  return preset.sounds.findIndex((s) => s.name === name);
}

/** Whether the mix already holds a sound with this name. */
export function holdsSound(preset: PhonePreset, name: string): boolean {
  return preset.sounds.some((s) => s.name === name);
}

// Removes sound `index`; Sound Group members after it move down one. A
// group left empty stays (it can get new members); sharing drops it.
export function removeSoundAt<T extends PhonePreset>(preset: T, index: number): T {
  const p = withFiles(preset);
  const groups = Array.isArray(p.manifest.groups) ? (p.manifest.groups as Bag[]) : [];
  const nextGroups = groups.map((g) => {
    const members = Array.isArray(g?.soundIndexes) ? (g.soundIndexes as number[]) : [];
    return { ...g, soundIndexes: members.filter((m) => m !== index).map((m) => (m > index ? m - 1 : m)) };
  });
  return {
    ...p,
    sounds: p.sounds.filter((_, i) => i !== index),
    manifest: { ...p.manifest, groups: nextGroups, sounds: manifestSounds(p.manifest).filter((_, i) => i !== index) },
  };
}

export function setSoundOn<T extends PhonePreset>(preset: T, index: number, on: boolean): T {
  return { ...preset, sounds: preset.sounds.map((s, i) => (i === index ? { ...s, off: !on } : s)) };
}

/** Renames sound `index` in this mix only (the audio file and the library
 * keep their names). An empty name changes nothing. */
export function renameSoundAt<T extends PhonePreset>(preset: T, index: number, name: string): T {
  const next = name.trim().slice(0, 80);
  if (!next || !preset.sounds[index]) return preset;
  return {
    ...preset,
    sounds: preset.sounds.map((s, i) => (i === index ? { ...s, name: next } : s)),
    manifest: {
      ...preset.manifest,
      sounds: manifestSounds(preset.manifest).map((s, i) => (i === index ? { ...s, name: next } : s)),
    },
  };
}

export function renamed<T extends PhonePreset>(preset: T, name: string): T {
  return { ...preset, name, manifest: { ...preset.manifest, name } };
}

/** The gain a sound plays at: its volume, or silence when turned off. */
export function playedVolume(sound: PhoneSound): number {
  return sound.off ? 0 : sound.volume;
}

/** The gain with Solo on (`solo` = the soloed sound's index, or null): that
 * sound plays at its volume even if it is off, every other one is silent. */
export function soloGain(sound: PhoneSound, index: number, solo: number | null): number {
  if (solo === null) return playedVolume(sound);
  return index === solo ? sound.volume : 0;
}

/** What a shared mix holds: its manifest, and which audio file each zip
 * entry comes from. Volumes and "off" are the phone's current ones. */
export function shareManifest(preset: PhonePreset, nowIso: string): { manifest: Bag; audio: { zipName: string; file: string }[] } {
  const raws = manifestSounds(preset.manifest);
  const audio = preset.sounds.map((s, i) => ({ zipName: `audio/${soundFile(s, i)}`, file: soundFile(s, i) }));
  const sounds = preset.sounds.map((s, i) => ({
    ...raws[i],
    name: s.name,
    bundleName: soundFile(s, i),
    volume: s.volume,
    ...(s.off ? { off: true } : {}),
  }));
  const manifest = {
    ...preset.manifest,
    format: PRESET_FORMAT,
    formatVersion: 2,
    phone: { version: SUPPORTED_PHONE_VERSION },
    exportedAt: nowIso,
    name: preset.name,
    // Empty groups are dropped, as the desktop's export does.
    groups: (Array.isArray(preset.manifest.groups) ? (preset.manifest.groups as Bag[]) : []).filter(
      (g) => Array.isArray(g?.soundIndexes) && g.soundIndexes.length > 0,
    ),
    sounds,
  };
  return { manifest, audio };
}

// Rough memory a mix takes while playing: every clip decoded to 32-bit
// float stereo at the phone's rate (the desktop's export warning, ~300 MB).
export const HEAVY_MIX_MB = 300;

export function decodedMb(sounds: PhoneSound[], sampleRate = 48000): number {
  const seconds = sounds.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  return (seconds * sampleRate * 2 * 4) / (1024 * 1024);
}

/** A mix card's second line: its first few sounds that are on, "+N" for the rest. */
export function soundsSummary(sounds: { name: string; off?: boolean }[], shown = 3): string {
  if (sounds.length === 0) return 'No sounds yet';
  const on = sounds.filter((s) => !s.off).map((s) => s.name);
  if (on.length === 0) return `${sounds.length} sound${sounds.length === 1 ? '' : 's'}, all off`;
  const rest = on.length - shown;
  return on.slice(0, shown).join(' · ') + (rest > 0 ? ` +${rest}` : '');
}

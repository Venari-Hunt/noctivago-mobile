// Reads a phone preset: the .ncvpreset the desktop's Export → "For phone"
// writes (contract: ../noctivago/docs/mobile.md, "Phone preset file").
// Pure rules, no files or audio, so `npm test` can load it.

export const PRESET_FORMAT = 'noctivago-preset';
export const MANIFEST_NAME = 'preset.json';
export const SUPPORTED_PHONE_VERSION = 1;

export type PlayMode = 'loop' | 'scatter' | 'scheduled';

export type PhoneSound = {
  name: string;
  /** Name inside the zip's audio/ folder. */
  bundleName: string;
  volume: number;
  playMode: PlayMode;
  durationSeconds: number | null;
};

export type PhonePreset = {
  name: string;
  sounds: PhoneSound[];
  /** The whole manifest as read, kept so later phases (groups, whole mix,
   * scatter, Fluctuation) can read the fields this one ignores. */
  manifest: Record<string, unknown>;
};

export type ReadResult =
  | { ok: true; preset: PhonePreset; audioEntries: string[] }
  | { ok: false; error: string };

const NOT_A_PRESET = "That file isn't a Noctívago preset.";
const DESKTOP_PRESET =
  'This is a regular Noctívago preset. On the PC, open Export, choose "For phone", and send the file it saves.';

export function clampVolume(v: unknown, fallback = 0.7): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
}

function playModeOf(settings: unknown): PlayMode {
  const mode = (settings as { playMode?: unknown } | null)?.playMode;
  return mode === 'scatter' || mode === 'scheduled' ? mode : 'loop';
}

// `entryNames` are the zip's file names; returns, per sound, the entry that
// holds its audio (matched like the desktop import: case-insensitive).
export function readPhonePreset(manifestText: string, entryNames: string[]): ReadResult {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestText.replace(/^﻿/, ''));
  } catch {
    return { ok: false, error: NOT_A_PRESET };
  }
  if (!manifest || manifest.format !== PRESET_FORMAT || !Array.isArray(manifest.sounds)) {
    return { ok: false, error: NOT_A_PRESET };
  }
  const phone = manifest.phone as { version?: unknown } | undefined;
  if (!phone || typeof phone.version !== 'number') return { ok: false, error: DESKTOP_PRESET };
  if (phone.version > SUPPORTED_PHONE_VERSION) {
    return { ok: false, error: 'This preset was saved by a newer Noctívago. Update the phone app, then try again.' };
  }
  if (manifest.sounds.length === 0) return { ok: false, error: 'This preset has no sounds.' };

  const byLower = new Map(entryNames.map((n) => [n.toLowerCase(), n]));
  const sounds: PhoneSound[] = [];
  const audioEntries: string[] = [];
  const missing: string[] = [];
  for (const raw of manifest.sounds as Record<string, unknown>[]) {
    const name = typeof raw?.name === 'string' && raw.name ? raw.name : 'Sound';
    const bundleName = typeof raw?.bundleName === 'string' ? raw.bundleName : '';
    const entry = bundleName ? byLower.get(`audio/${bundleName}`.toLowerCase()) : undefined;
    if (!entry) {
      missing.push(name);
      continue;
    }
    sounds.push({
      name,
      bundleName,
      volume: clampVolume(raw.volume),
      playMode: playModeOf(raw.settings),
      durationSeconds: typeof raw.durationSeconds === 'number' ? raw.durationSeconds : null,
    });
    audioEntries.push(entry);
  }
  if (missing.length > 0) {
    return { ok: false, error: `The file is missing the audio for: ${missing.join(', ')}. Export it again on the PC.` };
  }
  const name = typeof manifest.name === 'string' && manifest.name ? manifest.name : 'Imported preset';
  return { ok: true, preset: { name, sounds, manifest }, audioEntries };
}

// Folder name for a saved preset: readable, unique, safe on any filesystem.
export function presetFolderName(name: string, nowMs: number): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'preset'}-${nowMs.toString(36)}`;
}

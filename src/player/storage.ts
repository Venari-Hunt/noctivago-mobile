import { Directory, File, Paths } from 'expo-file-system';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { LibrarySound } from '../library/domain/library';
import { soundAudioUri } from '../library/storage';
import {
  appendSound,
  audioFileName,
  emptyManifest,
  removeSoundAt,
  renamed,
  shareManifest,
  soundFile,
  uniqueName,
  withFiles,
} from './domain/mixEdit';
import { MANIFEST_NAME, presetFolderName, readPhonePreset, zipNameAsUtf8, type PhonePreset } from './domain/presetFile';

// Mixes (imported or made on the phone) live in the app's own storage, one
// folder each:
//   presets/<folder>/saved.json     SavedPreset (below)
//   presets/<folder>/audio/<file>   each sound's audio (mixEdit.soundFile)
// The original zip is not kept; its audio is all the phone needs. A sound
// added from the library is copied in, so deleting it from the library
// leaves the mix whole.

export type SavedPreset = PhonePreset & {
  id: string;
  master: number;
  importedAt: number;
};

const SAVED_NAME = 'saved.json';

function root() {
  const dir = new Directory(Paths.document, 'presets');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function audioDir(preset: SavedPreset) {
  return new Directory(root(), preset.id, 'audio');
}

export function audioUri(preset: SavedPreset, index: number) {
  return new File(audioDir(preset), soundFile(preset.sounds[index], index)).uri;
}

export function listPresets(): SavedPreset[] {
  const out: SavedPreset[] = [];
  for (const item of root().list()) {
    if (!(item instanceof Directory)) continue;
    const file = new File(item, SAVED_NAME);
    if (!file.exists) continue;
    try {
      out.push(JSON.parse(file.textSync()));
    } catch {
      // A half-written import (app killed mid-write): not listed.
    }
  }
  return out.sort((a, b) => b.importedAt - a.importedAt);
}

export function savePreset(preset: SavedPreset) {
  new File(root(), preset.id, SAVED_NAME).writeSync(JSON.stringify(preset));
}

export function deletePreset(preset: SavedPreset) {
  const dir = new Directory(root(), preset.id);
  if (dir.exists) dir.delete();
}

// An empty mix, saved right away so it shows in Mixes.
export function createPreset(): SavedPreset {
  const now = Date.now();
  const name = uniqueName('New mix', listPresets().map((p) => p.name));
  const preset: SavedPreset = { name, sounds: [], manifest: emptyManifest(name), id: presetFolderName(name, now), master: 0.8, importedAt: now };
  audioDir(preset).create({ intermediates: true });
  savePreset(preset);
  return preset;
}

export function renamePreset(preset: SavedPreset, name: string): SavedPreset {
  const next = renamed(preset, name);
  savePreset(next);
  return next;
}

// "Save a copy": a new folder with its own copy of the audio.
export async function copyPreset(preset: SavedPreset, name: string): Promise<SavedPreset> {
  const now = Date.now();
  const copy: SavedPreset = { ...renamed(withFiles(preset), name), id: presetFolderName(name, now), importedAt: now };
  const dir = audioDir(copy);
  dir.create({ intermediates: true });
  try {
    for (const [i, s] of preset.sounds.entries()) {
      await new File(audioDir(preset), soundFile(s, i)).copy(new File(dir, soundFile(s, i)));
    }
    savePreset(copy);
    return copy;
  } catch (e) {
    new Directory(root(), copy.id).delete();
    throw e;
  }
}

// Copies library sounds into the mix, at the end, as plain loops.
export async function addLibrarySounds(preset: SavedPreset, sounds: LibrarySound[]): Promise<SavedPreset> {
  let next = withFiles(preset);
  const dir = audioDir(next);
  if (!dir.exists) dir.create({ intermediates: true });
  for (const sound of sounds) {
    const file = audioFileName(sound.name, sound.ext, next.sounds.map((s, i) => soundFile(s, i)));
    await new File(soundAudioUri(sound)).copy(new File(dir, file));
    next = appendSound(next, sound, file);
  }
  savePreset(next);
  return next;
}

export function removeSound(preset: SavedPreset, index: number): SavedPreset {
  const audio = new File(audioDir(preset), soundFile(preset.sounds[index], index));
  const next = removeSoundAt(preset, index);
  savePreset(next);
  if (audio.exists) audio.delete();
  return next;
}

// Writes the mix as a .ncvpreset in the cache, ready for the share sheet.
// Same format as the desktop's "For phone" export, so it imports on the
// phone and on the PC.
export async function writeShareFile(preset: SavedPreset): Promise<string> {
  const { manifest, audio } = shareManifest(preset, new Date().toISOString());
  const entries: Record<string, Uint8Array> = { [MANIFEST_NAME]: strToU8(JSON.stringify(manifest, null, 2)) };
  for (const a of audio) entries[a.zipName] = await new File(audioDir(preset), a.file).bytes();
  // Audio is already compressed: stored, not deflated.
  const zip = zipSync(entries, { level: 0 });
  const file = new File(Paths.cache, `${preset.name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'Mix'}.ncvpreset`);
  if (file.exists) file.delete();
  file.create();
  file.writeSync(zip);
  return file.uri;
}

// Opens the system file picker and imports the chosen phone preset.
// Returns the saved preset, null when cancelled, or throws a readable Error.
export async function importFromPicker(): Promise<SavedPreset | null> {
  const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (picked.canceled) return null;
  return importBytes(await picked.result.bytes());
}

// A file another app handed over ("Open with" or Share): a content:// or
// file:// URI, readable right away.
export async function importFromUri(uri: string): Promise<SavedPreset> {
  let bytes: Uint8Array;
  try {
    bytes = await new File(uri).bytes();
  } catch {
    throw new Error("Couldn't read that file. Save it to the phone first, then use Import preset.");
  }
  return importBytes(bytes);
}

// Opus and Ogg clips are stored as "<i>.ogg" (as before 0.7.0); any other
// audio a phone-made mix carries (MP3, FLAC…) keeps its extension.
function storedName(entry: string, index: number): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(entry)?.[1].toLowerCase() ?? 'ogg';
  return `${index}.${ext === 'opus' ? 'ogg' : ext}`;
}

// Importing a preset with the same name as a saved one replaces it, so
// re-sending an updated export (or tapping the file twice) never duplicates.
export function importBytes(bytes: Uint8Array): SavedPreset {
  let entries: Record<string, Uint8Array>;
  try {
    entries = Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, data]) => [zipNameAsUtf8(name), data]));
  } catch {
    throw new Error("That file isn't a Noctívago preset.");
  }
  const manifestEntry = entries[MANIFEST_NAME] ?? entries[`./${MANIFEST_NAME}`];
  if (!manifestEntry) throw new Error("That file isn't a Noctívago preset.");
  const read = readPhonePreset(strFromU8(manifestEntry), Object.keys(entries));
  if (!read.ok) throw new Error(read.error);

  const now = Date.now();
  const id = presetFolderName(read.preset.name, now);
  const dir = new Directory(root(), id);
  const audio = new Directory(dir, 'audio');
  audio.create({ intermediates: true });
  try {
    const files = read.audioEntries.map(storedName);
    read.audioEntries.forEach((entry, i) => {
      const file = new File(audio, files[i]);
      file.create();
      file.writeSync(entries[entry]);
    });
    const sounds = read.preset.sounds.map((s, i) => ({ ...s, file: files[i] }));
    const saved: SavedPreset = { ...read.preset, sounds, id, master: 0.8, importedAt: now };
    savePreset(saved);
    for (const old of listPresets()) {
      if (old.id !== id && old.name === saved.name) deletePreset(old);
    }
    return saved;
  } catch (e) {
    dir.delete();
    throw e;
  }
}

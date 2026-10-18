import { Directory, File, Paths } from 'expo-file-system';
import { strFromU8, unzipSync } from 'fflate';
import { MANIFEST_NAME, presetFolderName, readPhonePreset, zipNameAsUtf8, type PhonePreset } from './domain/presetFile';

// Imported presets live in the app's own storage, one folder each:
//   presets/<folder>/saved.json   SavedPreset (below)
//   presets/<folder>/audio/<i>.ogg the sound's baked clip, by index
// The original zip is not kept; its audio is all the phone needs.

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

export function audioUri(preset: SavedPreset, index: number) {
  return new File(root(), preset.id, 'audio', `${index}.ogg`).uri;
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
    read.audioEntries.forEach((entry, i) => {
      const file = new File(audio, `${i}.ogg`);
      file.create();
      file.writeSync(entries[entry]);
    });
    const saved: SavedPreset = { ...read.preset, id, master: 0.8, importedAt: now };
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

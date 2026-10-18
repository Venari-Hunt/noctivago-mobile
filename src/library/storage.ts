import { Directory, File, Paths } from 'expo-file-system';
import { decodeAudioData } from 'react-native-audio-api';
import { nameFromFile, soundFolderName, storedExtension, type LibrarySound } from './domain/library';

// Sounds you add live in the app's own storage, one folder each:
//   library/<id>/sound.json    LibrarySound
//   library/<id>/audio.<ext>   a copy of the file as added (not converted)
// A copy, not a link to the original: Android can take back a picker's
// permission, and the original can be moved or deleted.

const SOUND_NAME = 'sound.json';
// Decoding at a low rate is enough to learn a file's length and that it
// plays, at a fraction of the memory a full decode takes.
const PROBE_SAMPLE_RATE = 8000;

function root() {
  const dir = new Directory(Paths.document, 'library');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function soundAudioUri(sound: LibrarySound) {
  return new File(root(), sound.id, `audio.${sound.ext}`).uri;
}

export function listSounds(): LibrarySound[] {
  const out: LibrarySound[] = [];
  for (const item of root().list()) {
    if (!(item instanceof Directory)) continue;
    const file = new File(item, SOUND_NAME);
    if (!file.exists) continue;
    try {
      out.push(JSON.parse(file.textSync()));
    } catch {
      // A half-written add (app killed mid-copy): not listed.
    }
  }
  return out;
}

export function saveSound(sound: LibrarySound) {
  new File(root(), sound.id, SOUND_NAME).writeSync(JSON.stringify(sound));
}

export function deleteSound(sound: LibrarySound) {
  const dir = new Directory(root(), sound.id);
  if (dir.exists) dir.delete();
}

export type AddResult = { added: LibrarySound[]; failed: string[] };

// Opens the system file picker (several files at once) and adds the chosen
// audio files. Null when cancelled.
export async function addFromPicker(onProgress?: (done: number, total: number) => void): Promise<AddResult | null> {
  const picked = await File.pickFileAsync({ multipleFiles: true, mimeTypes: ['audio/*'] });
  if (picked.canceled) return null;
  return addFiles(picked.result, onProgress);
}

// A file another app handed over ("Open with" or Share).
export async function addFromUri(uri: string): Promise<AddResult> {
  return addFiles([new File(uri)]);
}

export async function addFiles(files: File[], onProgress?: (done: number, total: number) => void): Promise<AddResult> {
  const result: AddResult = { added: [], failed: [] };
  const now = Date.now();
  // One at a time: each file is decoded once to check it plays.
  for (const [i, file] of files.entries()) {
    const fileName = safeName(file);
    try {
      result.added.push(await addOne(file, fileName, now, i));
    } catch {
      result.failed.push(fileName);
    }
    onProgress?.(i + 1, files.length);
  }
  return result;
}

async function addOne(file: File, fileName: string, now: number, salt: number): Promise<LibrarySound> {
  const ext = storedExtension(fileName, safeType(file));
  const id = soundFolderName(nameFromFile(fileName), now, salt);
  const dir = new Directory(root(), id);
  dir.create({ intermediates: true });
  try {
    const copy = new File(dir, `audio.${ext}`);
    try {
      await file.copy(copy);
    } catch {
      // Some content:// providers refuse a direct copy; reading works.
      copy.create();
      copy.writeSync(await file.bytes());
    }
    const probe = await decodeAudioData(copy.uri, PROBE_SAMPLE_RATE);
    const sound: LibrarySound = {
      id,
      name: nameFromFile(fileName),
      fileName,
      ext,
      tags: [],
      durationSeconds: probe.duration,
      addedAt: now + salt,
    };
    saveSound(sound);
    return sound;
  } catch (e) {
    dir.delete();
    throw e;
  }
}

function safeName(file: File): string {
  try {
    if (file.name) return decodeURIComponent(file.name);
  } catch {}
  const last = file.uri.split('/').pop() || 'Sound';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function safeType(file: File): string | null {
  try {
    return file.type || null;
  } catch {
    return null;
  }
}

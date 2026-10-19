import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { decodeAudioData } from 'react-native-audio-api';
import { incomingFileName, isAudioFile, nameFromFile, soundFolderName, storedExtension, type LibrarySound } from './domain/library';
import { MAX_LINK_BYTES } from './domain/link';

// Sounds you add live in the app's own storage, one folder each:
//   library/<id>/sound.json    LibrarySound
//   library/<id>/audio.<ext>   a copy of the file as added (not converted)
// A copy, not a link to the original: Android can take back a picker's
// permission, and the original can be moved or deleted.

const SOUND_NAME = 'sound.json';
const USER_AGENT = `Noctivago/${Constants.expoConfig?.version ?? '0'} (https://github.com/Venari-Hunt/noctivago-mobile)`;
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

/** A file to add: where it is, and what the picker or share called it. */
export type IncomingSound = { uri: string; name?: string | null; mimeType?: string | null };

// Opens the system file picker (several files at once) and adds the chosen
// audio files. Null when cancelled. expo-document-picker, not
// File.pickFileAsync: it returns each file's real name, where the file API
// only knows Android's document id ("msf:1000293491").
export async function addFromPicker(onProgress?: (done: number, total: number) => void): Promise<AddResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
  if (picked.canceled) return null;
  const result = await addFiles(
    picked.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType })),
    onProgress,
  );
  // The picker's cache copies are no longer needed.
  for (const a of picked.assets) {
    try {
      const f = new File(a.uri);
      if (f.exists) f.delete();
    } catch {}
  }
  return result;
}

// Downloads a direct audio link (already checked by `checkLink`) and adds it.
// The server's name for the file is kept when it reads as audio.
export async function addFromLink(url: string): Promise<AddResult> {
  const temp = new Directory(Paths.cache, `link-${Date.now().toString(36)}`);
  temp.create({ intermediates: true });
  try {
    let file: File;
    try {
      // Some hosts (Wikimedia) refuse Android's default "okhttp" agent.
      file = await File.downloadFileAsync(url, temp, { headers: { 'User-Agent': USER_AGENT } });
    } catch (e) {
      const status = /\b([45]\d\d)\b/.exec(e instanceof Error ? e.message : String(e));
      throw new Error(status ? `The link answered ${status[1]}. Check that it still works in a browser.` : "Couldn't download that link. Check your connection.");
    }
    if (file.size > MAX_LINK_BYTES) throw new Error('That file is over 200 MB, too big for the phone.');
    const name = isAudioFile(file.name, file.type) ? file.name : incomingFileName(null, url);
    return await addFiles([{ uri: file.uri, name, mimeType: file.type }]);
  } finally {
    try {
      temp.delete();
    } catch {}
  }
}

export async function addFiles(files: IncomingSound[], onProgress?: (done: number, total: number) => void): Promise<AddResult> {
  const result: AddResult = { added: [], failed: [] };
  const now = Date.now();
  // One at a time: each file is decoded once to check it plays.
  for (const [i, file] of files.entries()) {
    const fileName = incomingFileName(file.name, file.uri);
    try {
      result.added.push(await addOne(file, fileName, now, i));
    } catch {
      result.failed.push(fileName);
    }
    onProgress?.(i + 1, files.length);
  }
  return result;
}

async function addOne(incoming: IncomingSound, fileName: string, now: number, salt: number): Promise<LibrarySound> {
  const ext = storedExtension(fileName, incoming.mimeType);
  const id = soundFolderName(nameFromFile(fileName), now, salt);
  const dir = new Directory(root(), id);
  dir.create({ intermediates: true });
  try {
    const source = new File(incoming.uri);
    const copy = new File(dir, `audio.${ext}`);
    try {
      await source.copy(copy);
    } catch {
      // Some content:// providers refuse a direct copy; reading works.
      if (!copy.exists) copy.create();
      copy.writeSync(await source.bytes());
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

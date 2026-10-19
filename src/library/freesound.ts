import { Directory, File, Paths } from 'expo-file-system';
import { freesoundSource, isFreesoundUrl, parseSearch, previewFileName, searchError, searchUrl, type FreesoundPage, type FreesoundResult } from './domain/freesound';
import { addFiles, saveSound, type AddResult } from './storage';

// Browse Sounds: Freesound search and add. The app-wide key is the desktop's
// own (owner, 2026-10-18), set as the EAS variable EXPO_PUBLIC_FREESOUND_API_KEY
// and inlined at bundle time; without it the button is hidden.
const KEY = process.env.EXPO_PUBLIC_FREESOUND_API_KEY ?? '';

export function isFreesoundAvailable() {
  return KEY.length > 0;
}

export async function searchFreesound(query: string, page: number): Promise<FreesoundPage> {
  const url = searchUrl(query, page, KEY);
  if (!url) return { results: [], count: 0, hasMore: false };
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Couldn't reach Freesound. Check your connection.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(searchError(res.status, body?.detail));
  }
  return parseSearch(await res.json());
}

// The preview with the token, for listening before adding.
export function previewLink(result: FreesoundResult): string {
  if (!isFreesoundUrl(result.previewUrl)) throw new Error('Not a Freesound link.');
  const url = new URL(result.previewUrl);
  url.searchParams.set('token', KEY);
  return url.toString();
}

// Downloads the preview MP3 into the library, with its author and license.
export async function addFromFreesound(result: FreesoundResult): Promise<AddResult> {
  const temp = new Directory(Paths.cache, `freesound-${Date.now().toString(36)}`);
  temp.create({ intermediates: true });
  try {
    let file: File;
    try {
      file = await File.downloadFileAsync(previewLink(result), temp);
    } catch {
      throw new Error("Couldn't download that sound. Check your connection.");
    }
    const added = await addFiles([{ uri: file.uri, name: previewFileName(result.name), mimeType: 'audio/mpeg' }]);
    added.added = added.added.map((sound) => {
      const credited = { ...sound, tags: result.tags.slice(0, 5), source: freesoundSource(result, sound.addedAt) };
      saveSound(credited);
      return credited;
    });
    return added;
  } finally {
    try {
      temp.delete();
    } catch {}
  }
}

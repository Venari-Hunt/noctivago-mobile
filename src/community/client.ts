import { importBytes, type SavedPreset } from '../player/storage';
import { bundleUrl, listUrl, parseList, type CommunityPage, type CommunitySort } from './domain/community';

// Reads the community server (browse and download only; sharing stays on
// the PC, where presets are made).

const OFFLINE = "Couldn't reach the community server. Check your connection.";

export async function listCommunity(query: string, sort: CommunitySort, page: number): Promise<CommunityPage> {
  let res: Response;
  try {
    res = await fetch(listUrl(query, sort, page));
  } catch {
    throw new Error(OFFLINE);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `The community server answered ${res.status}.`);
  return parseList(body);
}

// Downloads the whole file (the server has no partial reads), keeps only
// its phone copy, and saves it as a mix.
export async function downloadCommunity(id: string): Promise<SavedPreset> {
  let res: Response;
  try {
    res = await fetch(bundleUrl(id));
  } catch {
    throw new Error(OFFLINE);
  }
  if (!res.ok) throw new Error(res.status === 404 ? 'That preset is no longer available.' : `Download failed (${res.status}).`);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    throw new Error('The download stopped halfway. Try again.');
  }
  return importBytes(bytes, { onlyPhoneCopy: true });
}

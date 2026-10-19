// The Community tab: presets people shared from the PC app. Pure rules, no
// network, so `npm test` can load it. The server is the desktop's
// (`community/` in the desktop repo, a Cloudflare Worker); the phone only
// reads from it.
//
// One file for both apps (desktop v0.1.270): a community .ncvpreset holds the
// PC's editable preset at its root (preset.json, audio/) and a baked phone
// copy under phone/ (phone/preset.json, phone/audio/), the same thing
// Export → "For phone" saves. The phone plays only the phone copy.

export const COMMUNITY_API = 'https://noctivago-community.noctivago-community.workers.dev/v1';
export const PAGE_SIZE = 24;
export const PHONE_LAYER_DIR = 'phone';

export type CommunitySort = 'new' | 'popular';

export type CommunityPreset = {
  id: string;
  name: string;
  author: string;
  description: string;
  tags: string[];
  soundCount: number;
  durationSeconds: number | null;
  sizeBytes: number | null;
  downloads: number;
};

export type CommunityPage = { results: CommunityPreset[]; hasMore: boolean };

export function listUrl(query: string, sort: CommunitySort, page: number): string {
  const params = new URLSearchParams({ q: query.trim(), sort, page: String(Math.max(1, Math.round(page) || 1)), pageSize: String(PAGE_SIZE) });
  return `${COMMUNITY_API}/presets?${params}`;
}

const ID_RE = /^[0-9a-f]{32}$/;

export function bundleUrl(id: string): string {
  if (!ID_RE.test(id)) throw new Error('Invalid preset id.');
  return `${COMMUNITY_API}/presets/${id}/bundle`;
}

export function parseList(data: unknown): CommunityPage {
  const body = (data ?? {}) as { ok?: boolean; results?: unknown[]; hasMore?: boolean; error?: string };
  if (!body.ok) throw new Error(body.error || 'The community server sent something unexpected.');
  const results: CommunityPreset[] = [];
  for (const raw of body.results ?? []) {
    const r = raw as Record<string, any>;
    if (!ID_RE.test(String(r?.id))) continue;
    results.push({
      id: r.id,
      name: String(r.name ?? 'Untitled'),
      author: String(r.author ?? ''),
      description: String(r.description ?? ''),
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      soundCount: Number(r.soundCount) || 0,
      durationSeconds: Number.isFinite(r.durationSeconds) ? r.durationSeconds : null,
      sizeBytes: Number.isFinite(r.sizeBytes) ? r.sizeBytes : null,
      downloads: Number(r.downloads) || 0,
    });
  }
  return { results, hasMore: Boolean(body.hasMore) };
}

// Unzipping only what the phone needs: the phone copy, plus the root
// manifest to tell an older upload apart.
export function wantedEntry(name: string): boolean {
  return name === 'preset.json' || name.startsWith(`${PHONE_LAYER_DIR}/`);
}

export const NO_PHONE_COPY =
  'This preset was shared before the phone could play community presets. Ask its author to share it again from the PC app (version 0.1.270 or newer).';

// A manifest the phone plays as is: made by "For phone" or on a phone.
export function isPhoneManifest(text: string): boolean {
  try {
    const m = JSON.parse(text.replace(/^﻿/, ''));
    return typeof m?.phone?.version === 'number';
  } catch {
    return false;
  }
}

// The phone copy's entries moved to the root, the way a "For phone" file
// lays them out; null when the file has none. A file that is already a
// phone preset (shared from a phone) comes back as it is.
export function phoneLayer(entries: Record<string, Uint8Array>, isPhoneManifest: (text: string) => boolean, decode: (bytes: Uint8Array) => string): Record<string, Uint8Array> | null {
  const prefix = `${PHONE_LAYER_DIR}/`;
  if (entries[`${prefix}preset.json`]) {
    const out: Record<string, Uint8Array> = {};
    for (const [name, data] of Object.entries(entries)) {
      if (name.startsWith(prefix) && name.length > prefix.length) out[name.slice(prefix.length)] = data;
    }
    return out;
  }
  const root = entries['preset.json'];
  return root && isPhoneManifest(decode(root)) ? entries : null;
}

export function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb < 0.1 ? '<0.1 MB' : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export function presetDetails(p: CommunityPreset): string {
  const parts = [p.author ? `by ${p.author}` : '', `${p.soundCount} sound${p.soundCount === 1 ? '' : 's'}`, formatSize(p.sizeBytes)];
  if (p.downloads > 0) parts.push(`${p.downloads} download${p.downloads === 1 ? '' : 's'}`);
  return parts.filter(Boolean).join(' · ');
}

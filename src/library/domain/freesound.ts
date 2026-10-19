// Browse Sounds: searching Freesound and keeping each sound's credit. Pure
// rules, no network, so `npm test` can load it. Same API calls as the
// desktop (`src/main/freesound/client.js`): text search with the app-wide
// token, and the compressed preview (128 kbps MP3), never the original file.

export const FREESOUND_API = 'https://freesound.org/apiv2';
export const PAGE_SIZE = 15;
const SEARCH_FIELDS = 'id,name,username,previews,duration,license,tags,description';

export type FreesoundResult = {
  id: number;
  name: string;
  username: string;
  durationSeconds: number | null;
  license: string;
  tags: string[];
  description: string;
  previewUrl: string;
  pageUrl: string;
};

export type FreesoundPage = { results: FreesoundResult[]; count: number; hasMore: boolean };

/** The desktop's `source` for a Freesound sound, kept in shared mixes for credits. */
export type FreesoundSource = {
  type: 'freesound';
  freesoundId: number;
  username: string;
  license: string;
  pageUrl: string;
  title: string;
  description: string;
  tags: string[];
  importedAt: number;
};

export function searchUrl(query: string, page: number, token: string): string | null {
  const q = query.trim();
  if (!q) return null;
  const url = new URL(`${FREESOUND_API}/search/text/`);
  url.searchParams.set('query', q);
  url.searchParams.set('fields', SEARCH_FIELDS);
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('page', String(Math.max(Math.round(page) || 1, 1)));
  url.searchParams.set('sort', 'score');
  url.searchParams.set('token', token);
  return url.toString();
}

// Keeps only results with a preview to download.
export function parseSearch(data: unknown): FreesoundPage {
  const body = (data ?? {}) as { count?: number; next?: string | null; results?: unknown[] };
  const results: FreesoundResult[] = [];
  for (const raw of body.results ?? []) {
    const r = raw as Record<string, any>;
    const previewUrl = r?.previews?.['preview-hq-mp3'] || r?.previews?.['preview-lq-mp3'];
    if (!previewUrl || !Number.isInteger(r.id)) continue;
    results.push({
      id: r.id,
      name: String(r.name ?? 'Freesound sound'),
      username: String(r.username ?? ''),
      durationSeconds: typeof r.duration === 'number' ? r.duration : null,
      license: String(r.license ?? ''),
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      description: String(r.description ?? ''),
      previewUrl,
      pageUrl: `https://freesound.org/s/${r.id}/`,
    });
  }
  return { results, count: body.count ?? results.length, hasMore: Boolean(body.next) };
}

// What a failed search tells the user, by HTTP status.
export function searchError(status: number, detail?: string): string {
  if (status === 429) return "Freesound's rate limit was hit. Try again in a minute.";
  if (status >= 500) return `Freesound is down for now (${status}). Try again shortly.`;
  return `Freesound search failed (${status})${detail ? `: ${detail}` : '.'}`;
}

// The token only ever goes to Freesound's own servers.
export function isFreesoundUrl(link: string): boolean {
  try {
    const host = new URL(link).hostname.toLowerCase();
    return host === 'freesound.org' || host.endsWith('.freesound.org');
  } catch {
    return false;
  }
}

// Freesound licenses are Creative Commons deed links.
export function licenseLabel(license: string): string {
  const l = license.toLowerCase();
  if (l.includes('publicdomain/zero') || l.includes('cc0')) return 'CC0';
  if (l.includes('sampling+')) return 'Sampling+';
  const m = /licenses\/([a-z-]+)\//.exec(l);
  if (m) return `CC ${m[1].toUpperCase()}`;
  return license ? 'See license' : '';
}

// The file name a preview is stored under: the sound's name, as MP3.
export function previewFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]{1,5}$/i, '').trim() || 'Freesound sound';
  return `${base}.mp3`;
}

export function freesoundSource(r: FreesoundResult, now: number): FreesoundSource {
  const description = r.description.replace(/\s+/g, ' ').trim();
  return {
    type: 'freesound',
    freesoundId: r.id,
    username: r.username,
    license: r.license,
    pageUrl: r.pageUrl,
    title: r.name,
    description: description.length > 400 ? `${description.slice(0, 397)}...` : description,
    tags: r.tags.slice(0, 15),
    importedAt: now,
  };
}

// The phone's sound library: sounds you add yourself, before they go into a
// mix. Pure rules, no files or audio, so `npm test` can load it.

import type { FreesoundSource } from './freesound';

export type LibrarySound = {
  id: string;
  name: string;
  /** The file's name when it was added, extension included. */
  fileName: string;
  /** Lowercase extension of the stored copy ("mp3", "flac"…). */
  ext: string;
  tags: string[];
  durationSeconds: number | null;
  addedAt: number;
  /** Where it came from, when that needs crediting (Freesound). */
  source?: FreesoundSource | null;
};

export type SortBy = 'newest' | 'name' | 'length';

// What the desktop imports (Getting started: mp3, wav, ogg, flac, m4a, opus),
// plus the near relatives the phone's decoder also reads.
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac', 'mp4', 'aif', 'aiff'];

// Past this a sound still plays, but its decoded copy is big (the desktop's
// MAX_BUFFER_CLIP_SECONDS: 10 minutes is ~230 MB of memory while playing).
export const LONG_SOUND_SECONDS = 600;

export function extensionOf(fileName: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(fileName.trim());
  return m ? m[1].toLowerCase() : '';
}

// A file another app handed over is a sound (not a preset) when its type or
// its name says audio.
export function isAudioFile(fileName: string, mimeType?: string | null): boolean {
  if (mimeType && /^audio\//i.test(mimeType)) return true;
  return AUDIO_EXTENSIONS.includes(extensionOf(fileName));
}

const MIME_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
};

// The extension to store a sound under: its file name's, else one from its
// type (a shared file can arrive as "document:1234" with only a type).
export function storedExtension(fileName: string, mimeType?: string | null): string {
  const ext = extensionOf(fileName);
  if (AUDIO_EXTENSIONS.includes(ext)) return ext;
  return (mimeType && MIME_EXTENSIONS[mimeType.toLowerCase()]) || ext || 'audio';
}

// Android often hands over only an internal id ("msf:1000293491", "1234",
// "document:12"): not a name worth showing.
function looksLikeId(name: string): boolean {
  return /^(msf|document|raw|primary|audio|image|video):/i.test(name) || /^\d+$/.test(name);
}

// The file name to use for something handed over: the name the picker or
// share gave, else the URI's last part when it reads like a file name.
export function incomingFileName(name: string | null | undefined, uri: string): string {
  const given = name?.trim();
  if (given && !looksLikeId(given)) return given;
  let last = uri.split(/[/?#]/).filter(Boolean).pop() ?? '';
  try {
    last = decodeURIComponent(last);
  } catch {}
  last = last.replace(/^.*[\\/:]/, '');
  return last && !looksLikeId(last) && extensionOf(last) ? last : 'Sound';
}

/** The sound's name: the file name without its extension. */
export function nameFromFile(fileName: string): string {
  const base = fileName.trim().replace(/^.*[\\/]/, '');
  const ext = extensionOf(base);
  const name = ext ? base.slice(0, -(ext.length + 1)) : base;
  return name.trim() || 'Sound';
}

// Folder name for a stored sound: readable, unique, safe on any filesystem.
export function soundFolderName(name: string, nowMs: number, salt = 0): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'sound'}-${nowMs.toString(36)}${salt ? `-${salt}` : ''}`;
}

/** "rain, night ,Rain" → ["rain", "night"]: trimmed, no blanks, no repeats. */
export function parseTags(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const tag = raw.trim();
    if (tag && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out;
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Search matches the name or a tag, ignoring case and accents; every word
// of the query has to match ("rain night" finds a rain sound tagged night).
export function filterSounds(sounds: LibrarySound[], query: string): LibrarySound[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return sounds;
  return sounds.filter((s) => {
    const hay = fold([s.name, ...s.tags].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

export function sortSounds(sounds: LibrarySound[], by: SortBy): LibrarySound[] {
  const out = [...sounds];
  if (by === 'name') out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
  else if (by === 'length') out.sort((a, b) => (b.durationSeconds ?? -1) - (a.durationSeconds ?? -1));
  else out.sort((a, b) => b.addedAt - a.addedAt);
  return out;
}

/** What an add did, in one line: "Added 3 sounds. Couldn't read: notes.txt." */
export function addSummary(added: number, failed: string[]): string {
  const parts: string[] = [];
  if (added > 0) parts.push(`Added ${added} sound${added === 1 ? '' : 's'}.`);
  if (failed.length > 0) parts.push(`Couldn't read: ${failed.join(', ')}.`);
  return parts.join(' ');
}

/** 75 → "1:15", 3725 → "1:02:05", null → "". */
export function formatLength(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** One sound of a saved mix, as the library sees it. */
export type MixSound = { name: string; bytes: number };

// The sounds of a mix the library still lacks. Same name (any case) and same
// file size counts as the same sound: a mix built from the library copies
// the file as is, so its sounds are never added twice. Repeats inside the
// mix count once.
export function missingFromLibrary<T extends MixSound>(mix: T[], library: MixSound[]): T[] {
  const key = (s: MixSound) => `${s.name.trim().toLowerCase()}|${s.bytes}`;
  const have = new Set(library.map(key));
  const out: T[] = [];
  for (const s of mix) {
    if (have.has(key(s))) continue;
    have.add(key(s));
    out.push(s);
  }
  return out;
}

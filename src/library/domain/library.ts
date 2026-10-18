// The phone's sound library: sounds you add yourself, before they go into a
// mix. Pure rules, no files or audio, so `npm test` can load it.

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

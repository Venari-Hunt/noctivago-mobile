import { strFromU8, unzipSync } from 'fflate';
import { zipNameAsUtf8 } from '../../player/domain/presetFile.ts';
import { isPhoneManifest, NO_PHONE_COPY, PHONE_LAYER_DIR, phoneLayer, wantedEntry } from './community.ts';
import { extract, findIndex, readIndex, spanOf, TAIL_BYTES } from './zipIndex.ts';

// Downloads only a community preset's phone copy: the zip's index from the
// end of the file, then the phone/ part (Beach: ~7 MB of 46). A server
// without partial reads answers the first request with the whole file,
// which works too. Pure apart from `read`, so `npm test` runs it on real
// files.

/** One HTTP read: `range` is a Range header value. */
export type RangeRead = (range: string) => Promise<{ partial: boolean; total: number | null; bytes: Uint8Array }>;

/** The phone copy's files (preset.json, audio/…), ready for `importEntries`. */
export async function readPhoneCopy(read: RangeRead): Promise<Record<string, Uint8Array>> {
  const first = await read(`bytes=-${TAIL_BYTES}`);
  if (!first.partial) return wholeFile(first.bytes);

  const tail = first.bytes;
  const total = first.total ?? tail.length;
  const tailStart = total - tail.length;
  const where = findIndex(tail);
  const index =
    where.offset >= tailStart
      ? tail.subarray(where.offset - tailStart, where.offset - tailStart + where.size)
      : (await read(`bytes=${where.offset}-${where.offset + where.size - 1}`)).bytes;

  const prefix = `${PHONE_LAYER_DIR}/`;
  const wanted = readIndex(index)
    .map((e) => ({ ...e, name: zipNameAsUtf8(e.name) }))
    .filter((e) => e.name.startsWith(prefix) && e.name.length > prefix.length);
  if (wanted.length === 0) throw new Error(NO_PHONE_COPY);

  const span = spanOf(wanted, where.offset);
  const chunk = span.start >= tailStart ? tail.subarray(span.start - tailStart) : (await read(`bytes=${span.start}-${span.end}`)).bytes;
  return layerOf(extract(chunk, span.start, wanted));
}

function wholeFile(bytes: Uint8Array): Record<string, Uint8Array> {
  let entries: Record<string, Uint8Array>;
  try {
    const all = unzipSync(bytes, { filter: (f) => wantedEntry(zipNameAsUtf8(f.name)) });
    entries = Object.fromEntries(Object.entries(all).map(([name, data]) => [zipNameAsUtf8(name), data]));
  } catch {
    throw new Error("That file isn't a Noctívago preset.");
  }
  return layerOf(entries);
}

function layerOf(entries: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const layer = phoneLayer(entries, isPhoneManifest, strFromU8);
  if (!layer) throw new Error(NO_PHONE_COPY);
  return layer;
}

import { inflateSync, strFromU8 } from 'fflate';

// Reading parts of a zip without the whole file: its index (the "central
// directory") sits at the end, and says where each file starts. The
// Community tab uses it to download only a preset's phone/ copy. Pure, so
// `npm test` can load it. No zip64: community files stay far under 4 GB.

export type ZipEntry = { name: string; method: number; compressedSize: number; localOffset: number };

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
/** Enough of the end of a file to hold the end record and its longest comment. */
export const TAIL_BYTES = 22 + 0xffff;

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

/** Where the index is, from the last bytes of the file. */
export function findIndex(tail: Uint8Array): { offset: number; size: number } {
  const v = view(tail);
  for (let i = tail.length - 22; i >= 0; i--) {
    if (v.getUint32(i, true) === EOCD_SIG) return { size: v.getUint32(i + 12, true), offset: v.getUint32(i + 16, true) };
  }
  throw new Error("That file isn't a Noctívago preset.");
}

// Names are UTF-8 when the zip says so (flag bit 11), else read byte for byte
// (the caller fixes those with `zipNameAsUtf8`, like a full unzip does).
export function readIndex(index: Uint8Array): ZipEntry[] {
  const v = view(index);
  const out: ZipEntry[] = [];
  let p = 0;
  while (p + 46 <= index.length && v.getUint32(p, true) === CD_SIG) {
    const flags = v.getUint16(p + 8, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const raw = index.subarray(p + 46, p + 46 + nameLen);
    out.push({
      name: strFromU8(raw, !(flags & 0x800)),
      method: v.getUint16(p + 10, true),
      compressedSize: v.getUint32(p + 20, true),
      localOffset: v.getUint32(p + 42, true),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** One byte range covering `entries` (they sit together, phone/ last). */
export function spanOf(entries: ZipEntry[], indexOffset: number): { start: number; end: number } {
  const start = Math.min(...entries.map((e) => e.localOffset));
  return { start, end: indexOffset - 1 };
}

// Unpacks `entries` from `chunk`, the bytes of the file starting at
// `chunkStart`. Stored and deflated entries, like the apps write.
export function extract(chunk: Uint8Array, chunkStart: number, entries: ZipEntry[]): Record<string, Uint8Array> {
  const v = view(chunk);
  const out: Record<string, Uint8Array> = {};
  for (const e of entries) {
    const at = e.localOffset - chunkStart;
    if (at < 0 || at + 30 > chunk.length || v.getUint32(at, true) !== LOCAL_SIG) throw new Error('The download came back incomplete. Try again.');
    const dataAt = at + 30 + v.getUint16(at + 26, true) + v.getUint16(at + 28, true);
    const data = chunk.subarray(dataAt, dataAt + e.compressedSize);
    if (data.length !== e.compressedSize) throw new Error('The download came back incomplete. Try again.');
    if (e.method === 0) out[e.name] = data;
    else if (e.method === 8) out[e.name] = inflateSync(data);
    else throw new Error("That preset uses a zip format the phone can't read.");
  }
  return out;
}

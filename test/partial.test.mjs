import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { readPhoneCopy } from '../src/community/domain/partial.ts';
import { NO_PHONE_COPY } from '../src/community/domain/community.ts';
import { findIndex, readIndex } from '../src/community/domain/zipIndex.ts';

const json = (o) => strToU8(JSON.stringify(o));
const noise = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed * 7) & 255);
const phoneManifest = { format: 'noctivago-preset', phone: { version: 1 }, sounds: [{ name: 'Água', bundleName: 'água.opus' }] };

// Root first, phone/ last, as the PC packs it. The root audio is big, so
// downloading it would show up in the byte count.
const file = zipSync({
  'preset.json': json({ format: 'noctivago-preset', sounds: [] }),
  'audio/big.opus': [noise(300_000, 1), { level: 0 }],
  'phone/preset.json': json(phoneManifest),
  'phone/audio/água.opus': [noise(120_000, 2), { level: 0 }],
  'phone/audio/small.opus': [strToU8('x'.repeat(5000)), { level: 6 }],
});

// Answers like the community server: one range, 206 with the total.
function server(bytes, { ranges = true } = {}) {
  const log = { requests: 0, bytes: 0 };
  const read = async (range) => {
    log.requests += 1;
    if (!ranges) {
      log.bytes += bytes.length;
      return { partial: false, total: null, bytes };
    }
    const [, a, b] = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = a === '' ? Math.max(0, bytes.length - Number(b)) : Number(a);
    const end = a === '' || b === '' ? bytes.length : Number(b) + 1;
    const part = bytes.subarray(start, end);
    log.bytes += part.length;
    return { partial: true, total: bytes.length, bytes: part };
  };
  return { read, log };
}

test('only the phone copy is downloaded, deflated and UTF-8 names included', async () => {
  const { read, log } = server(file);
  const files = await readPhoneCopy(read);
  assert.deepEqual(Object.keys(files).sort(), ['audio/small.opus', 'audio/água.opus', 'preset.json']);
  assert.equal(files['audio/água.opus'].length, 120_000);
  assert.equal(new TextDecoder().decode(files['audio/small.opus']), 'x'.repeat(5000));
  assert.ok(log.bytes < 200_000, `downloaded ${log.bytes} of ${file.length}`);
  assert.equal(log.requests, 2);
});

test('a server without partial reads sends the whole file, which works too', async () => {
  const { read, log } = server(file, { ranges: false });
  const files = await readPhoneCopy(read);
  assert.ok(files['preset.json']);
  assert.equal(log.requests, 1);
});

test('an upload without a phone copy says so, without downloading it', async () => {
  const old = zipSync({ 'preset.json': json({ format: 'noctivago-preset', sounds: [] }), 'audio/big.opus': [noise(300_000, 3), { level: 0 }] });
  const { read, log } = server(old);
  await assert.rejects(readPhoneCopy(read), { message: NO_PHONE_COPY });
  assert.equal(log.requests, 1);
});

test('the index lists every file with where it starts', () => {
  const tail = file.subarray(file.length - 1000);
  const where = findIndex(tail);
  const names = readIndex(file.subarray(where.offset, where.offset + where.size)).map((e) => e.name);
  assert.deepEqual(names, ['preset.json', 'audio/big.opus', 'phone/preset.json', 'phone/audio/água.opus', 'phone/audio/small.opus']);
});

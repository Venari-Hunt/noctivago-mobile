import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { bundleUrl, isPhoneManifest, listUrl, parseList, phoneLayer, presetDetails, wantedEntry } from '../src/community/domain/community.ts';
import { readPhonePreset } from '../src/player/domain/presetFile.ts';

const phoneManifest = { format: 'noctivago-preset', formatVersion: 2, name: 'Beach', phone: { version: 1 }, wholeMix: {}, groups: [], sounds: [{ name: 'Waves', bundleName: 'waves.opus', volume: 0.5, settings: { playMode: 'loop' } }] };
const pcManifest = { format: 'noctivago-preset', formatVersion: 2, name: 'Beach', wholeMix: {}, groups: [], sounds: [{ name: 'Waves', bundleName: 'waves.opus', volume: 0.5, settings: { playMode: 'loop', filters: { gainDb: 3 } } }] };
const json = (o) => strToU8(JSON.stringify(o));

// What the desktop's community upload packs since v0.1.270.
const communityZip = zipSync({
  'preset.json': json(pcManifest),
  'audio/waves.opus': new Uint8Array([1, 1, 1]),
  'phone/preset.json': json(phoneManifest),
  'phone/audio/waves.opus': new Uint8Array([2, 2]),
});

test('a community file imports its phone copy, without unzipping the PC audio', () => {
  const entries = unzipSync(communityZip, { filter: (f) => wantedEntry(f.name) });
  assert.equal(entries['audio/waves.opus'], undefined);
  const layer = phoneLayer(entries, isPhoneManifest, strFromU8);
  assert.deepEqual(Object.keys(layer).sort(), ['audio/waves.opus', 'preset.json']);
  assert.deepEqual([...layer['audio/waves.opus']], [2, 2]);
  const read = readPhonePreset(strFromU8(layer['preset.json']), Object.keys(layer));
  assert.equal(read.ok, true);
  assert.deepEqual(read.audioEntries, ['audio/waves.opus']);
});

test('an upload from before v0.1.270 has no phone copy', () => {
  const entries = unzipSync(zipSync({ 'preset.json': json(pcManifest), 'audio/waves.opus': new Uint8Array([1]) }));
  assert.equal(phoneLayer(entries, isPhoneManifest, strFromU8), null);
});

test('a plain phone preset comes back as it is', () => {
  const entries = unzipSync(zipSync({ 'preset.json': json(phoneManifest), 'audio/waves.opus': new Uint8Array([1]) }));
  assert.equal(phoneLayer(entries, isPhoneManifest, strFromU8), entries);
});

test('the list URL carries search, sort and page; ids are checked', () => {
  const url = new URL(listUrl(' rain ', 'popular', 2));
  assert.equal(url.searchParams.get('q'), 'rain');
  assert.equal(url.searchParams.get('sort'), 'popular');
  assert.equal(url.searchParams.get('page'), '2');
  assert.match(bundleUrl('6f787555e2ba4ec9b5e5951057911380'), /\/presets\/6f787555e2ba4ec9b5e5951057911380\/bundle$/);
  assert.throws(() => bundleUrl('../admin'));
});

test('the server list parses, and its errors surface', () => {
  const page = parseList({ ok: true, hasMore: true, results: [{ id: '6f787555e2ba4ec9b5e5951057911380', name: 'Beach', author: 'Venari', soundCount: 18, sizeBytes: 41522118, downloads: 3, tags: ['beach'] }, { id: 'bad' }] });
  assert.equal(page.results.length, 1);
  assert.equal(page.hasMore, true);
  assert.equal(presetDetails(page.results[0]), 'by Venari · 18 sounds · 40 MB · 3 downloads');
  assert.throws(() => parseList({ ok: false, error: 'Too many requests' }), /Too many requests/);
});

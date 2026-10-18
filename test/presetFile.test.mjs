import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPhonePreset, presetFolderName, clampVolume, zipNameAsUtf8 } from '../src/player/domain/presetFile.ts';

const manifest = (over = {}) =>
  JSON.stringify({
    format: 'noctivago-preset',
    formatVersion: 2,
    name: 'Beach',
    phone: { version: 1 },
    sounds: [
      { name: 'Waves', bundleName: 'waves.opus', volume: 0.5, settings: { playMode: 'loop' }, durationSeconds: 30 },
      { name: 'Gull', bundleName: 'Gull.opus', volume: 2, settings: { playMode: 'scatter' } },
    ],
    ...over,
  });

test('reads a phone preset and finds each sound\'s audio', () => {
  const r = readPhonePreset(manifest(), ['preset.json', 'audio/waves.opus', 'audio/gull.opus']);
  assert.equal(r.ok, true);
  assert.equal(r.preset.name, 'Beach');
  assert.deepEqual(r.audioEntries, ['audio/waves.opus', 'audio/gull.opus']);
  assert.deepEqual(r.preset.sounds.map((s) => [s.playMode, s.volume]), [['loop', 0.5], ['scatter', 1]]);
});

test('a desktop preset asks for the phone export', () => {
  const r = readPhonePreset(manifest({ phone: undefined }), ['audio/waves.opus', 'audio/gull.opus']);
  assert.equal(r.ok, false);
  assert.match(r.error, /For phone/);
});

test('rejects files that are not presets, newer versions, missing audio', () => {
  assert.equal(readPhonePreset('not json', []).ok, false);
  assert.match(readPhonePreset(manifest({ phone: { version: 9 } }), []).error, /newer/);
  assert.match(readPhonePreset(manifest(), ['audio/waves.opus']).error, /Gull/);
});

test('a BOM before the JSON is fine', () => {
  assert.equal(readPhonePreset('﻿' + manifest(), ['audio/waves.opus', 'audio/gull.opus']).ok, true);
});

test('folder names are plain ASCII and unique per import', () => {
  assert.equal(presetFolderName('Noctívago: Chuva forte!', 0), 'noctivago-chuva-forte-0');
  assert.equal(presetFolderName('***', 36), 'preset-10');
});

test('volumes stay within 0..1', () => {
  assert.equal(clampVolume(-1), 0);
  assert.equal(clampVolume('x'), 0.7);
});

// Desktop exports before v0.1.269 left the zip's UTF-8 flag off (owner's
// Rain Inside preset, 2026-10-18).
test('zip names written as UTF-8 without the flag are read back', () => {
  const garbled = Buffer.from('audio/Encampment ｜ Forest picolé.opus', 'utf8').toString('latin1');
  assert.equal(zipNameAsUtf8(garbled), 'audio/Encampment ｜ Forest picolé.opus');
  assert.equal(zipNameAsUtf8('audio/plain.opus'), 'audio/plain.opus');
  assert.equal(zipNameAsUtf8('audio/Encampment ｜ Forest.opus'), 'audio/Encampment ｜ Forest.opus');
  assert.equal(zipNameAsUtf8('audio/café.opus'), 'audio/café.opus'); // real Latin-1: not valid UTF-8
});

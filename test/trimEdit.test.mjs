import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipTime, setTrim, trimFrames, trimOf } from '../src/player/domain/trimEdit.ts';

const mix = (settings) => ({
  name: 'M',
  sounds: [{ name: 'Rain', bundleName: 'r.mp3', volume: 1, playMode: 'loop', durationSeconds: 60 }],
  manifest: { sounds: [{ name: 'Rain', settings }] },
});

test('a sound with no trim plays whole', () => {
  assert.equal(trimFrames(mix({}).manifest, 0, 1000, 60000), null);
  assert.deepEqual(trimOf(mix({}).manifest, 0, 60), { start: 0, end: 60 });
});

test('a desktop phone export (0 to the clip length) plays whole, even if decoding is a hair off', () => {
  assert.equal(trimFrames(mix({ loopStart: 0, loopEnd: 60 }).manifest, 0, 1000, 60000), null);
  assert.equal(trimFrames(mix({ loopStart: 0, loopEnd: 60.03 }).manifest, 0, 1000, 59980), null);
});

test('a real trim keeps just that range of samples', () => {
  assert.deepEqual(trimFrames(mix({ loopStart: 10, loopEnd: 25.5 }).manifest, 0, 1000, 60000), { start: 10000, end: 25500 });
  assert.deepEqual(trimFrames(mix({ loopStart: 5 }).manifest, 0, 1000, 60000), { start: 5000, end: 60000 });
});

test('setTrim keeps the bounds ordered, inside the clip, and other settings', () => {
  let m = mix({ playMode: 'loop' });
  m = setTrim(m, 0, 60, { start: 10 });
  assert.deepEqual(trimOf(m.manifest, 0, 60), { start: 10, end: 60 });
  m = setTrim(m, 0, 60, { end: 30 });
  assert.deepEqual(trimOf(m.manifest, 0, 60), { start: 10, end: 30 });
  // Start can't pass the end; end can't pass the start.
  assert.equal(trimOf(setTrim(m, 0, 60, { start: 50 }).manifest, 0, 60).start, 29.9);
  assert.equal(trimOf(setTrim(m, 0, 60, { end: 5 }).manifest, 0, 60).end, 10.1);
  assert.equal(trimOf(setTrim(m, 0, 60, { end: 999 }).manifest, 0, 60).end, 60);
  assert.equal(m.manifest.sounds[0].settings.playMode, 'loop');
});

test('clipTime reads naturally', () => {
  assert.equal(clipTime(12), '12.0 s');
  assert.equal(clipTime(65.3), '1:05.3');
});

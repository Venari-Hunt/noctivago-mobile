import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeSoundFilters, setSoundFilter, soundFilterValue } from '../src/player/domain/soundFilterEdit.ts';
import { soundFilterSpec } from '../src/player/domain/mixPlan.ts';

const mix = (filters) => ({
  name: 'M',
  sounds: [{ name: 'Rain', bundleName: 'r.mp3', volume: 1, playMode: 'loop', durationSeconds: 60 }],
  manifest: { sounds: [{ name: 'Rain', settings: filters === undefined ? {} : { filters, playMode: 'loop' } }], groups: [] },
});

test('a sound with no filters, or the empty filters a PC phone export writes, builds nothing', () => {
  assert.equal(soundFilterSpec(mix().manifest, 0), null);
  assert.equal(soundFilterSpec(mix({}).manifest, 0), null);
  assert.equal(activeSoundFilters(mix({}), 0), 0);
});

test('setting a filter is read back, clamped, and builds the live stage', () => {
  let m = setSoundFilter(mix({}), 0, 'highpassHz', 300);
  m = setSoundFilter(m, 0, 'gainDb', 6);
  assert.equal(soundFilterValue(m, 0, 'highpassHz'), 300);
  assert.equal(soundFilterValue(m, 0, 'lowpassHz'), 20000);
  assert.equal(activeSoundFilters(m, 0), 2);
  const spec = soundFilterSpec(m.manifest, 0);
  assert.equal(spec.stages.length, 1);
  assert.equal(spec.stages[0].type, 'highpass');
  assert.ok(Math.abs(spec.gain - 10 ** (6 / 20)) < 1e-9);
  assert.equal(soundFilterValue(setSoundFilter(m, 0, 'gainDb', 99), 0, 'gainDb'), 24);
  assert.equal(m.manifest.sounds[0].settings.playMode, 'loop');
});

test('echo comes through as repeats', () => {
  const m = setSoundFilter(setSoundFilter(mix({}), 0, 'echoDelayMs', 400), 0, 'echoDecay', 0.5);
  assert.equal(soundFilterSpec(m.manifest, 0).echo.delaySeconds, 0.4);
});

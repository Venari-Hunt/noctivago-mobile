import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addScheduleTime,
  durationText,
  normalizeTime,
  removeScheduleTime,
  scatterGap,
  scheduleOf,
  setPlayMode,
  setScatterGap,
  setSchedule,
} from '../src/player/domain/shotEdit.ts';
import { shotSettings } from '../src/player/domain/mixPlan.ts';

const mix = () => ({
  name: 'Night',
  sounds: [
    { name: 'Owl', bundleName: 'Owl.mp3', file: 'Owl.mp3', volume: 0.7, playMode: 'loop', durationSeconds: 3 },
    { name: 'Bell', bundleName: 'Bell.mp3', file: 'Bell.mp3', volume: 0.5, playMode: 'loop', durationSeconds: 2 },
  ],
  manifest: { sounds: [{ name: 'Owl', settings: { playMode: 'loop', fluctuation: { volume: { enabled: false } } } }, { name: 'Bell' }], groups: [] },
});

test('setPlayMode changes the mode in the player list and the manifest, keeping other settings', () => {
  const next = setPlayMode(mix(), 0, 'scatter');
  assert.equal(next.sounds[0].playMode, 'scatter');
  assert.equal(next.manifest.sounds[0].settings.playMode, 'scatter');
  assert.deepEqual(next.manifest.sounds[0].settings.fluctuation, { volume: { enabled: false } });
  assert.equal(next.sounds[1].playMode, 'loop');
  assert.equal(setPlayMode(mix(), 0, 'loop').sounds[0].playMode, 'loop');
});

test('a sound with no settings gets them when its mode is set', () => {
  const next = setPlayMode(mix(), 1, 'scheduled');
  assert.equal(next.manifest.sounds[1].settings.playMode, 'scheduled');
});

test('scatter gap defaults, edits, and the engine reads it back', () => {
  assert.deepEqual(scatterGap(mix(), 0), { min: 5, max: 35, fullyRandom: false });
  const next = setScatterGap(setPlayMode(mix(), 0, 'scatter'), 0, { min: 10, max: 20 });
  assert.deepEqual(scatterGap(next, 0), { min: 10, max: 20, fullyRandom: false });
  const cfg = shotSettings(next.manifest, 0, 'scatter');
  assert.equal(cfg.minGapSeconds, 10);
  assert.equal(cfg.maxGapSeconds, 20);
  // The max never drops below the min.
  assert.equal(scatterGap(setScatterGap(next, 0, { min: 40 }), 0).max, 40);
  assert.equal(scatterGap(setScatterGap(next, 0, { fullyRandom: true }), 0).fullyRandom, true);
});

test('normalizeTime accepts 24 h times only', () => {
  assert.equal(normalizeTime('6:5'), '06:05');
  assert.equal(normalizeTime('23:59'), '23:59');
  assert.equal(normalizeTime('7h30'), '07:30');
  assert.equal(normalizeTime('24:00'), null);
  assert.equal(normalizeTime('12:60'), null);
  assert.equal(normalizeTime('noon'), null);
});

test('schedule times are added sorted, deduplicated and removable', () => {
  let m = setPlayMode(mix(), 1, 'scheduled');
  m = addScheduleTime(m, 1, '12:00');
  m = addScheduleTime(m, 1, '6:30');
  m = addScheduleTime(m, 1, '12:00');
  assert.deepEqual(scheduleOf(m, 1).times, ['06:30', '12:00']);
  assert.equal(addScheduleTime(m, 1, 'x'), null);
  assert.deepEqual(scheduleOf(removeScheduleTime(m, 1, '06:30'), 1).times, ['12:00']);
  assert.deepEqual(shotSettings(m.manifest, 1, 'scheduled').times, ['06:30', '12:00']);
  const every = setSchedule(m, 1, { type: 'interval', intervalMinutes: 30 });
  assert.deepEqual([scheduleOf(every, 1).type, scheduleOf(every, 1).intervalMinutes], ['interval', 30]);
});

test('durationText reads naturally', () => {
  assert.equal(durationText(5), '5 s');
  assert.equal(durationText(90), '90 s');
  assert.equal(durationText(600), '10 min');
  assert.equal(durationText(5400), '90 min');
  assert.equal(durationText(7200), '2 h');
  assert.equal(durationText(9000), '2 h 30 min');
});

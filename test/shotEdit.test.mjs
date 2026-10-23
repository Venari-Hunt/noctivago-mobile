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

import { fadeMs, perPlay, perPlayText, setFadeMs, setPerPlay } from '../src/player/domain/shotEdit.ts';

test('per-play axes default to neutral, clamp, and are read by the shot engine', () => {
  const base = setPlayMode(mix(), 0, 'scatter');
  assert.deepEqual(perPlay(base, 0, 'scatter', 'volume'), { min: 1, max: 1, fullyRandom: false });
  assert.deepEqual(perPlay(base, 0, 'scatter', 'pitch'), { min: 0, max: 0, fullyRandom: false });
  const next = setPerPlay(base, 0, 'scatter', 'pitch', { min: -3, max: 2 });
  const cfg = shotSettings(next.manifest, 0, 'scatter');
  assert.equal(cfg.minPitchSemitones, -3);
  assert.equal(cfg.maxPitchSemitones, 2);
  // Out of range and crossed bounds are fixed.
  assert.deepEqual(perPlay(setPerPlay(base, 0, 'scatter', 'pitch', { min: -40, max: 99 }), 0, 'scatter', 'pitch'), { min: -12, max: 12, fullyRandom: false });
  assert.equal(perPlay(setPerPlay(next, 0, 'scatter', 'pitch', { min: 5 }), 0, 'scatter', 'pitch').max, 5);
  assert.equal(perPlay(setPerPlay(base, 0, 'scatter', 'speed', { min: 0.1 }), 0, 'scatter', 'speed').min, 0.5);
});

test('per-play settings go to schedule for a Scheduled sound and keep the gap settings', () => {
  let m = setScatterGap(setPlayMode(mix(), 1, 'scheduled'), 1, { min: 7, max: 9 });
  m = setPerPlay(m, 1, 'scheduled', 'pan', { min: -0.5, max: 0.5 });
  assert.equal(shotSettings(m.manifest, 1, 'scheduled').minPan, -0.5);
  assert.equal(shotSettings(m.manifest, 1, 'scatter').minGapSeconds, 7);
  assert.equal(perPlayText('pan', perPlay(m, 1, 'scheduled', 'pan')), 'L 50% to R 50%');
  assert.equal(perPlayText('volume', perPlay(m, 1, 'scheduled', 'volume')), 'Same every time');
  assert.equal(perPlayText('volume', { min: 0.4, max: 1, fullyRandom: false }), '40% to 100%');
  assert.equal(perPlayText('pitch', { min: 0, max: 0, fullyRandom: true }), 'Fully random');
});

test('fades are stored in milliseconds, clamped', () => {
  const m = setFadeMs(setPlayMode(mix(), 0, 'scatter'), 0, 'scatter', { inMs: 800, outMs: 99999 });
  assert.deepEqual(fadeMs(m, 0, 'scatter'), { inMs: 800, outMs: 5000 });
  assert.equal(shotSettings(m.manifest, 0, 'scatter').fadeInMs, 800);
});

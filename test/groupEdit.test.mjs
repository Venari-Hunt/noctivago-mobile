import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addGroup,
  deleteGroup,
  driftAxis,
  filterValue,
  groupOfSound,
  groupsOf,
  hzToPosition,
  positionToHz,
  renameGroup,
  setDrift,
  setFilter,
  setMember,
} from '../src/player/domain/groupEdit.ts';
import { groupBusSpecs, soundFluctuation } from '../src/player/domain/mixPlan.ts';
import { shareManifest } from '../src/player/domain/mixEdit.ts';

const mix = () => ({
  name: 'Night',
  sounds: [
    { name: 'Rain', bundleName: 'Rain.mp3', file: 'Rain.mp3', volume: 0.7, playMode: 'loop', durationSeconds: 30 },
    { name: 'Owl', bundleName: 'Owl.mp3', file: 'Owl.mp3', volume: 0.7, playMode: 'loop', durationSeconds: 20 },
    { name: 'Wind', bundleName: 'Wind.mp3', file: 'Wind.mp3', volume: 0.7, playMode: 'loop', durationSeconds: 60 },
  ],
  manifest: {
    format: 'noctivago-preset',
    phone: { version: 1 },
    name: 'Night',
    groups: [],
    sounds: [{ settings: { playMode: 'loop' } }, { settings: { playMode: 'loop' } }, { settings: { playMode: 'loop' } }],
  },
});

test('a new group takes the sound out of its old group, and names stay unique', () => {
  let p = addGroup(mix(), 'Outside', 0);
  p = addGroup(p, 'Outside', 0);
  assert.deepEqual(groupsOf(p).map((g) => [g.name, g.soundIndexes]), [['Outside', []], ['Outside 2', [0]]]);
  assert.equal(groupOfSound(p, 0), 1);
  assert.equal(groupOfSound(p, 1), -1);
});

test('joining a group leaves the old one; leaving keeps the group', () => {
  let p = addGroup(addGroup(mix(), 'A', 0), 'B', 1);
  p = setMember(p, 0, 1, true);
  assert.deepEqual(groupsOf(p).map((g) => g.soundIndexes), [[0, 1], []]);
  p = setMember(p, 0, 0, false);
  assert.deepEqual(groupsOf(p).map((g) => g.soundIndexes), [[1], []]);
});

test('rename and delete; deleting leaves its sounds in the mix', () => {
  let p = renameGroup(addGroup(mix(), 'A', 2), 0, '  Sky  ');
  assert.equal(groupsOf(p)[0].name, 'Sky');
  assert.equal(renameGroup(p, 0, '   '), p);
  p = deleteGroup(p, 0);
  assert.deepEqual(groupsOf(p), []);
  assert.equal(p.sounds.length, 3);
});

test('filters land where the engine reads them', () => {
  let p = addGroup(mix(), 'A', 0);
  assert.equal(groupBusSpecs(p.manifest)[0], null); // a plain group builds nothing
  p = setFilter(p, 0, 'lowpassHz', 800);
  p = setFilter(p, 0, 'gainDb', 99);
  assert.equal(filterValue(groupsOf(p)[0], 'gainDb'), 24);
  const spec = groupBusSpecs(p.manifest)[0];
  assert.deepEqual(spec.stages.map((s) => [s.type, s.frequency]), [['lowpass', 800]]);
  assert.ok(Math.abs(spec.gain - Math.pow(10, 24 / 20)) < 1e-9);
});

test('drift: shared volume runs on the bus and switches off the member own axis', () => {
  let p = addGroup(mix(), 'A', 0);
  p.manifest.sounds[0].settings.fluctuation = { volume: { enabled: true, min: 0.2, max: 0.4, bias: 0.3 } };
  p = setDrift(p, 0, 'volume', { enabled: true });
  assert.equal(groupBusSpecs(p.manifest)[0].drift.volume.enabled, true);
  assert.equal(soundFluctuation(p.manifest, 0).volume.enabled, false);
  // Each sound on its own: the bus leaves volume alone, members run the group's range.
  p = setDrift(p, 0, 'volume', { perSound: true, min: 0.6, max: 0.9 });
  assert.equal(groupBusSpecs(p.manifest)[0], null);
  const own = soundFluctuation(p.manifest, 0).volume;
  assert.deepEqual([own.enabled, own.min, own.max], [true, 0.6, 0.9]);
});

test('drift range stays ordered and the resting point inside it; pitch is always per sound', () => {
  let p = addGroup(mix(), 'A', 0);
  p = setDrift(p, 0, 'pan', { enabled: true, min: 0.8 }); // above the default max 0.5
  const pan = driftAxis(groupsOf(p)[0], 'pan');
  assert.deepEqual([pan.min, pan.max, pan.bias], [0.8, 0.8, 0.8]);
  p = setDrift(p, 0, 'pitch', { enabled: true, perSound: false });
  assert.equal(driftAxis(groupsOf(p)[0], 'pitch').perSound, true);
});

test('frequency sliders: log scale, ends mean off, round trip', () => {
  assert.equal(positionToHz('highpassHz', 0), 0);
  assert.equal(positionToHz('lowpassHz', 1), 20000);
  assert.equal(hzToPosition('highpassHz', 0), 0);
  for (const hz of [40, 300, 2000]) assert.ok(Math.abs(positionToHz('highpassHz', hzToPosition('highpassHz', hz)) - hz) <= 1);
  for (const hz of [150, 700, 6000]) assert.ok(Math.abs(positionToHz('lowpassHz', hzToPosition('lowpassHz', hz)) - hz) <= 50);
});

test('sharing drops empty groups and keeps the rest', () => {
  const p = addGroup(addGroup(mix(), 'Empty'), 'Full', 1);
  const { manifest } = shareManifest(p, '2026-10-19T00:00:00Z');
  assert.deepEqual(manifest.groups.map((g) => [g.name, g.soundIndexes]), [['Full', [1]]]);
});

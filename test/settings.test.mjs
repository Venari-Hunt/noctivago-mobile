import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, fadeLabel, parseSettings } from '../src/settings/domain/settings.ts';
import { fadePlan } from '../src/player/domain/sleepTimer.ts';

test('no saved file gives the defaults', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('junk'), DEFAULT_SETTINGS);
});

test('saved values come back', () => {
  const saved = { autoInstallUpdates: false, sleepFadeSeconds: 300, sleepAutoMinutes: 45, newSoundVolume: 0.4, browseSounds: false, community: false };
  assert.deepEqual(parseSettings(saved), saved);
});

test('broken values fall back one by one', () => {
  const s = parseSettings({ autoInstallUpdates: 'no', sleepFadeSeconds: 7, sleepAutoMinutes: -1, newSoundVolume: 3, community: false });
  assert.equal(s.autoInstallUpdates, true);
  assert.equal(s.sleepFadeSeconds, 30);
  assert.equal(s.sleepAutoMinutes, 0);
  assert.equal(s.newSoundVolume, 1);
  assert.equal(s.community, false);
});

test('fade labels', () => {
  assert.equal(fadeLabel(10), '10 s');
  assert.equal(fadeLabel(300), '5 min');
});

test('the sleep fade length is the setting, halved for short timers', () => {
  assert.deepEqual(fadePlan(3600, 300), { fadeStart: 3300, end: 3600 });
  assert.deepEqual(fadePlan(3600), { fadeStart: 3570, end: 3600 });
  assert.deepEqual(fadePlan(100, 300), { fadeStart: 50, end: 100 });
});

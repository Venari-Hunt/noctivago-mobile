import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbText, isClipping, latchClip, lowerAllVolumes, peakOf, suggestedLowerDb, toDb } from '../src/player/domain/levels.ts';

test('peak and dB', () => {
  assert.equal(peakOf([0.1, -0.7, 0.3]), 0.7);
  assert.equal(peakOf([]), 0);
  assert.ok(Math.abs(toDb(1)) < 1e-9);
  assert.ok(Math.abs(toDb(0.5) + 6.0206) < 1e-3);
  assert.equal(toDb(0), -60);
  assert.equal(dbText(-6.24), '-6.2 dB');
  assert.equal(dbText(1.44), '+1.4 dB');
  assert.equal(dbText(-60), 'silent');
});

test('the limiter acts above -1 dBFS', () => {
  assert.equal(isClipping(0.85), false);
  assert.equal(isClipping(0.95), true);
});

test('suggested lowering lands a peak near -2 dB', () => {
  assert.equal(suggestedLowerDb(3), 5);
  assert.equal(suggestedLowerDb(-0.5), 1.5);
  assert.equal(suggestedLowerDb(-1), 1);
  assert.equal(suggestedLowerDb(30), 12);
});

test('lowerAllVolumes scales every sound equally', () => {
  const m = { name: 'M', sounds: [{ name: 'a', volume: 1 }, { name: 'b', volume: 0.5 }], manifest: {} };
  const next = lowerAllVolumes(m, 6.0206);
  assert.ok(Math.abs(next.sounds[0].volume - 0.5) < 1e-3);
  assert.ok(Math.abs(next.sounds[1].volume - 0.25) < 1e-3);
  assert.equal(m.sounds[0].volume, 1);
});

test('the clip latch keeps the worst peak and every group that went hot', () => {
  assert.equal(latchClip(null, 0.5, [0.3, 0.2]), null);
  let l = latchClip(null, 1.2, [0.4, 1.1]);
  assert.deepEqual(l, { peak: 1.2, hotGroups: [1] });
  l = latchClip(l, 0.6, [1.0, 0.1]);
  assert.deepEqual(l, { peak: 1.2, hotGroups: [0, 1] });
  assert.equal(latchClip(l, 0.2, [0, 0]), l);
});

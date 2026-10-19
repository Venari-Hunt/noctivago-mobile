import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loopFadeSeconds, seamlessPlan, writeSeamless } from '../src/player/domain/seamlessLoop.ts';

test('phone-added sounds get the desktop default; desktop exports loop plainly', () => {
  assert.equal(loopFadeSeconds({ playMode: 'loop' }, 30), 0.2);
  assert.equal(loopFadeSeconds(undefined, 30), 0.2);
  assert.equal(loopFadeSeconds({ crossfadeSeconds: 0 }, 30), 0);
  assert.equal(loopFadeSeconds({ crossfadeSeconds: 1.5 }, 30), 1.5);
  assert.equal(loopFadeSeconds({ crossfadeSeconds: 1 }, 2), 0.5); // a quarter of the clip at most
});

test('no blend for a zero fade or a tiny clip', () => {
  assert.equal(seamlessPlan(48000, 48000, 0), null);
  assert.equal(seamlessPlan(3, 48000, 0.2), null);
  assert.deepEqual(seamlessPlan(100, 10, 0.5), { fadeFrames: 5, mid: 50, outLength: 95 });
});

// A linear ramp (sample i = i) shows every jump: the desktop's old bug
// skipped `fade` seconds at each wrap.
function render(length, fadeFrames) {
  const src = Float32Array.from({ length }, (_, i) => i);
  const plan = seamlessPlan(length, 1, fadeFrames);
  const out = new Float32Array(plan.outLength);
  writeSeamless(src, out, plan);
  return { out, plan };
}

test('starts on the middle and wraps back to it with no jump', () => {
  const { out, plan } = render(100, 10);
  assert.equal(out.length, 90);
  assert.equal(out[0], 50); // B body starts at the middle
  assert.equal(out[out.length - 1], 49); // A body ends right before it
  assert.equal(out[39], 89); // last B body sample, just before the blend
  assert.equal(out[40], 90); // blend starts fully on the tail
  assert.equal(out[50], 10); // A body continues the head
});

test('the blend is equal power', () => {
  const length = 4000;
  const f = 1000;
  const src = new Float32Array(length);
  for (let i = 0; i < f; i++) src[i] = 1; // head
  for (let i = length - f; i < length; i++) src[i] = 1; // tail
  const plan = seamlessPlan(length, 1, f);
  const out = new Float32Array(plan.outLength);
  writeSeamless(src, out, plan);
  const start = length - f - plan.mid;
  const middle = out[start + f / 2];
  assert.ok(Math.abs(middle - Math.SQRT2) < 0.01, `cos + sin at 45° = √2, got ${middle}`);
});

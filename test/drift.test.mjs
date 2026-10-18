import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DriftPlan, panLoudnessCurve } from '../src/player/domain/drift.ts';

const wind = { enabled: true, min: 0.4, max: 1, bias: 0.65, changeMinSeconds: 6, changeMaxSeconds: 14, transitionSeconds: 8 };

test('an axis that is off plans nothing', () => {
  assert.equal(DriftPlan.of('volume', undefined, 0), null);
  assert.equal(DriftPlan.of('pan', { ...wind, enabled: false }, 0), null);
});

test('the walk starts at its bias and glides like the desktop', () => {
  const plan = DriftPlan.of('volume', wind, 10);
  assert.equal(plan.start, 0.65);
  assert.ok(Math.abs(plan.tau - 8 / 3) < 1e-9);
});

test('targets stay in range, gaps follow the change times, calls continue', () => {
  const plan = DriftPlan.of('volume', wind, 10);
  const first = plan.stepsUntil(70);
  const second = plan.stepsUntil(400);
  const steps = [...first, ...second];
  assert.ok(first.length >= 4 && first.length <= 10);
  let last = 10;
  for (const s of steps) {
    assert.ok(s.target >= 0.4 && s.target <= 1, `target ${s.target}`);
    const gap = s.at - last;
    assert.ok(gap >= 6 - 1e-9 && gap <= 14 + 1e-9, `gap ${gap}`);
    last = s.at;
  }
  assert.ok(first.at(-1).at <= 70 && second[0].at > 70);
});

test('fully random pitch roams the whole +/-6 semitones', () => {
  const plan = DriftPlan.of('pitch', { enabled: true, fullyRandom: true, changeMinSeconds: 1, changeMaxSeconds: 1, transitionSeconds: 0 }, 0);
  const targets = plan.stepsUntil(2000).map((s) => s.target);
  assert.ok(Math.min(...targets) < -5 && Math.max(...targets) > 5);
});

test('pan loudness matches the desktop law: 1 at center, falling to the sides', () => {
  const curve = panLoudnessCurve(1025);
  assert.ok(Math.abs(curve[512] - 1) < 1e-6);
  assert.ok(Math.abs(curve[0] - Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(curve[1024] - Math.SQRT1_2) < 1e-6);
  for (let i = 0; i < 512; i++) assert.ok(Math.abs(curve[i] - curve[1024 - i]) < 1e-6);
});

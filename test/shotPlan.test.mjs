import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planShot, syncShot } from '../src/player/domain/shotPlan.ts';

test('a plain shot plays as is, without the stretch', () => {
  const plan = planShot({}, 4);
  assert.deepEqual(plan, {
    playbackRate: 1,
    detuneCents: 0,
    pitchCorrection: false,
    durationSeconds: 4,
    volume: 1,
    pan: 0,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
  });
});

test('speed is tape-style: shorter and higher, no stretch', () => {
  const plan = planShot({ minSpeed: 2, maxSpeed: 2 }, 4);
  assert.equal(plan.playbackRate, 2);
  assert.equal(plan.durationSeconds, 2);
  assert.equal(plan.pitchCorrection, false);
  assert.equal(plan.detuneCents, 0);
});

test('pitch keeps the length; speed still carries its own pitch', () => {
  const plan = planShot({ minPitchSemitones: 3, maxPitchSemitones: 3, minSpeed: 2, maxSpeed: 2 }, 4);
  assert.equal(plan.pitchCorrection, true);
  assert.equal(plan.durationSeconds, 2);
  assert.ok(Math.abs(plan.detuneCents - 1500) < 1e-9);
});

test('fades are clamped to half the shot', () => {
  const plan = planShot({ fadeInMs: 5000, fadeOutMs: 500 }, 4);
  assert.equal(plan.fadeInSeconds, 2);
  assert.equal(plan.fadeOutSeconds, 0.5);
});

test('sync: the group fires at the earliest planned shot', () => {
  const r = syncShot(30, [
    { pendingAt: 20, busyUntil: 0 },
    { pendingAt: 40, busyUntil: 0 },
  ]);
  assert.deepEqual(r, { at: 20, fire: [false, true] });
});

test('sync: a member mid-shot past that moment fires again; one ending earlier waits', () => {
  const r = syncShot(10, [
    { pendingAt: null, busyUntil: 12 },
    { pendingAt: null, busyUntil: 8 },
  ]);
  assert.deepEqual(r, { at: 10, fire: [true, false] });
});

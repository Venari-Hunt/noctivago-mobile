import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockReport } from '../src/player/domain/clockCheck.ts';

test('audio that kept running reports 100%', () => {
  const r = clockReport([
    { wallMs: 0, audioSec: 10 },
    { wallMs: 600_000, audioSec: 610 },
    { wallMs: 1_800_000, audioSec: 1810 },
  ]);
  assert.equal(r.ratio, 1);
  assert.equal(r.worstStallSec, 0);
  assert.equal(r.wallMinutes, 30);
});

test('a stall while locked shows in the ratio and the worst stall', () => {
  const r = clockReport([
    { wallMs: 0, audioSec: 0 },
    { wallMs: 60_000, audioSec: 60 },
    { wallMs: 1_260_000, audioSec: 61 },
  ]);
  assert.equal(r.worstStallSec, 1199);
  assert.ok(r.ratio < 0.06);
});

test('needs two samples', () => {
  assert.equal(clockReport([{ wallMs: 0, audioSec: 0 }]), null);
});

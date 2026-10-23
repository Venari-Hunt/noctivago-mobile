import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countdown, fadePlan, presetLabel, timerButtonLabel } from '../src/player/domain/sleepTimer.ts';

test('fade takes the last 30 s, or half of a short timer', () => {
  assert.deepEqual(fadePlan(900), { fadeStart: 870, end: 900 });
  assert.deepEqual(fadePlan(20), { fadeStart: 10, end: 20 });
});

test('countdown reads like a clock', () => {
  assert.equal(countdown(3909000), '1:05:09');
  assert.equal(countdown(1781000), '29:41');
  assert.equal(countdown(6200), '0:07');
  assert.equal(countdown(-5), '0:00');
});

test('preset labels match the desktop buttons', () => {
  assert.deepEqual([15, 60, 90, 120].map(presetLabel), ['15m', '1h', '1h 30m', '2h']);
});

test('timer button says Timer while off, else the time left', () => {
  assert.equal(timerButtonLabel(null), 'Timer');
  assert.equal(timerButtonLabel(1781000), '29:41');
});

import { minutesUntilClock } from '../src/player/domain/sleepTimer.ts';

test('minutesUntilClock counts to the next time on the clock', () => {
  const at = (h, m) => new Date(2026, 9, 23, h, m, 0, 0);
  assert.equal(minutesUntilClock('06:30', at(23, 0)), 450);
  assert.equal(minutesUntilClock('6:30', at(6, 0)), 30);
  // The same minute, or a time already past, means tomorrow.
  assert.equal(minutesUntilClock('06:30', at(6, 30)), 1440);
  assert.equal(minutesUntilClock('00:15', at(23, 45)), 30);
  assert.equal(minutesUntilClock('25:00', at(6, 0)), null);
});

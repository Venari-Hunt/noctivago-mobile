import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendCapped, parseNightLog } from '../src/player/domain/nightLog.ts';

test('night log keeps the newest lines under the cap', () => {
  let text = '';
  for (let i = 0; i < 5; i++) text = appendCapped(text, `{"n":${i}}`, 3);
  assert.equal(text, '{"n":2}\n{"n":3}\n{"n":4}\n');
});

test('night log reading skips cut and foreign lines', () => {
  const entries = parseNightLog('{"wallMs":1,"kind":"load"}\n{"wallMs":2,"ki\nhello\n{"other":1}\n');
  assert.deepEqual(entries, [{ wallMs: 1, kind: 'load' }]);
});

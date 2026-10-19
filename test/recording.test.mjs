import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultRecordingName, formatClock, permissionProblem, recordingFileName } from '../src/library/domain/recording.ts';

const at = new Date(2026, 9, 9, 7, 5);

test('an empty name becomes a dated "Recording"', () => {
  assert.equal(defaultRecordingName(at), 'Recording 2026-10-09 07:05');
  assert.equal(recordingFileName('   ', at), 'Recording 2026-10-09 07:05.m4a');
});

test('a typed name is kept, trimmed, without folder slashes', () => {
  assert.equal(recordingFileName('  Fan at night ', at), 'Fan at night.m4a');
  assert.equal(recordingFileName('rain/porch', at), 'rain porch.m4a');
  assert.equal(recordingFileName('/', at), 'Recording 2026-10-09 07:05.m4a');
});

test('the clock reads minutes and seconds, hours when needed', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(75.9), '1:15');
  assert.equal(formatClock(3725), '1:02:05');
  assert.equal(formatClock(-3), '0:00');
});

test('only a granted microphone has no problem', () => {
  assert.equal(permissionProblem('Granted'), null);
  assert.match(permissionProblem('Denied'), /Settings/);
  assert.match(permissionProblem('Undetermined'), /microphone/);
});

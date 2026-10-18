import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addSummary,
  extensionOf,
  filterSounds,
  formatLength,
  incomingFileName,
  isAudioFile,
  nameFromFile,
  parseTags,
  sortSounds,
  soundFolderName,
  storedExtension,
} from '../src/library/domain/library.ts';

const sound = (name, extra = {}) => ({ id: name, name, fileName: `${name}.mp3`, ext: 'mp3', tags: [], durationSeconds: null, addedAt: 0, ...extra });

test('audio files are told apart from presets', () => {
  assert.equal(isAudioFile('Rain.MP3'), true);
  assert.equal(isAudioFile('night.flac', null), true);
  assert.equal(isAudioFile('Beach - phone.ncvpreset', 'application/octet-stream'), false);
  assert.equal(isAudioFile('document:1234', 'audio/mpeg'), true);
  assert.equal(isAudioFile('notes.txt'), false);
});

test('stored extension comes from the name, else the type', () => {
  assert.equal(storedExtension('Rain.FLAC', 'audio/flac'), 'flac');
  assert.equal(storedExtension('document:1234', 'audio/mpeg'), 'mp3');
  assert.equal(storedExtension('voice note', 'audio/x-m4a'), 'm4a');
  assert.equal(storedExtension('mystery', null), 'audio');
});

test('handed-over files get a real name, never an Android id', () => {
  assert.equal(incomingFileName('Test Onda é.opus', 'content://x/msf%3A1'), 'Test Onda é.opus');
  assert.equal(incomingFileName('msf:1000293491', 'content://com.android.providers.media.documents/document/msf%3A1000293491'), 'Sound');
  assert.equal(incomingFileName(null, 'file:///storage/emulated/0/Download/Rain%20night.mp3'), 'Rain night.mp3');
  assert.equal(incomingFileName(null, 'content://media/external/audio/media/1234'), 'Sound');
  assert.equal(incomingFileName('', 'content://downloads/document/raw%3A%2Fstorage%2FDownload%2Fwind.flac'), 'wind.flac');
});

test('names come from the file name', () => {
  assert.equal(nameFromFile('Ambience, Seaside Waves.wav'), 'Ambience, Seaside Waves');
  assert.equal(nameFromFile('/storage/emulated/0/Music/rain.flac'), 'rain');
  assert.equal(nameFromFile('no extension'), 'no extension');
  assert.equal(nameFromFile('.mp3'), 'Sound');
  assert.equal(extensionOf('a.tar.Opus'), 'opus');
});

test('folder names are safe and unique', () => {
  assert.equal(soundFolderName('Picolé caseiro ｜ Maceió', 36), 'picole-caseiro-maceio-10');
  assert.equal(soundFolderName('!!!', 1), 'sound-1');
  assert.notEqual(soundFolderName('rain', 5), soundFolderName('rain', 5, 1));
});

test('tags are trimmed and deduplicated', () => {
  assert.deepEqual(parseTags(' rain, night ,Rain,, '), ['rain', 'night']);
  assert.deepEqual(parseTags(''), []);
});

test('search matches name or tag, every word, ignoring accents', () => {
  const list = [sound('Chuva forte', { tags: ['noite'] }), sound('Picolé vendor'), sound('Waves', { tags: ['beach'] })];
  assert.deepEqual(filterSounds(list, 'chuva NOITE').map((s) => s.name), ['Chuva forte']);
  assert.deepEqual(filterSounds(list, 'picole').map((s) => s.name), ['Picolé vendor']);
  assert.deepEqual(filterSounds(list, 'beach').map((s) => s.name), ['Waves']);
  assert.equal(filterSounds(list, '  ').length, 3);
});

test('sorting by newest, name and length', () => {
  const list = [sound('b', { addedAt: 1, durationSeconds: 30 }), sound('A10', { addedAt: 3 }), sound('a2', { addedAt: 2, durationSeconds: 90 })];
  assert.deepEqual(sortSounds(list, 'newest').map((s) => s.name), ['A10', 'a2', 'b']);
  assert.deepEqual(sortSounds(list, 'name').map((s) => s.name), ['a2', 'A10', 'b']);
  assert.deepEqual(sortSounds(list, 'length').map((s) => s.name), ['a2', 'b', 'A10']);
});

test('add summary says what was added and what failed', () => {
  assert.equal(addSummary(1, []), 'Added 1 sound.');
  assert.equal(addSummary(3, ['notes.txt']), "Added 3 sounds. Couldn't read: notes.txt.");
  assert.equal(addSummary(0, ['a.mp3', 'b.wav']), "Couldn't read: a.mp3, b.wav.");
});

test('lengths read like a clock', () => {
  assert.equal(formatLength(75), '1:15');
  assert.equal(formatLength(3725), '1:02:05');
  assert.equal(formatLength(null), '');
});

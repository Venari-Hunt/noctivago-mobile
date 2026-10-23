import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendSound,
  audioFileName,
  decodedMb,
  duplicateSoundAt,
  soundsSummary,
  emptyManifest,
  playedVolume,
  removeSoundAt,
  renameSoundAt,
  setSoundOn,
  shareManifest,
  soundFile,
  uniqueName,
} from '../src/player/domain/mixEdit.ts';
import { readPhonePreset } from '../src/player/domain/presetFile.ts';

// An imported preset as saved before 0.7.0: files by position, no `file`.
const imported = () => ({
  name: 'Beach',
  sounds: [
    { name: 'Waves', bundleName: 'waves.opus', volume: 0.5, playMode: 'loop', durationSeconds: 30 },
    { name: 'Gull', bundleName: 'gull.opus', volume: 0.4, playMode: 'scatter', durationSeconds: 2 },
    { name: 'Wind', bundleName: 'wind.opus', volume: 0.3, playMode: 'loop', durationSeconds: 60 },
  ],
  manifest: {
    format: 'noctivago-preset',
    formatVersion: 2,
    phone: { version: 1 },
    name: 'Beach',
    groups: [{ name: 'Sky', soundIndexes: [1, 2] }, { name: 'Sea', soundIndexes: [0] }],
    sounds: [
      { name: 'Waves', bundleName: 'waves.opus', settings: { playMode: 'loop' } },
      { name: 'Gull', bundleName: 'gull.opus', settings: { playMode: 'scatter', scatter: { minGapSeconds: 5 } } },
      { name: 'Wind', bundleName: 'wind.opus', settings: { playMode: 'loop' } },
    ],
  },
});

const rain = { name: 'Rain', fileName: 'rain.mp3', durationSeconds: 120 };

test('old saves keep their files by position', () => {
  const p = imported();
  assert.equal(soundFile(p.sounds[2], 2), '2.ogg');
  assert.equal(soundFile({ ...p.sounds[2], file: 'x.mp3' }, 2), 'x.mp3');
});

test('adding a sound appends a plain loop to the sounds and the manifest', () => {
  const p = appendSound(imported(), rain, 'Rain.mp3');
  assert.equal(p.sounds.length, 4);
  assert.deepEqual(p.sounds.map((s, i) => soundFile(s, i)), ['0.ogg', '1.ogg', '2.ogg', 'Rain.mp3']);
  assert.equal(p.sounds[3].playMode, 'loop');
  assert.equal(p.sounds[3].volume, 0.7);
  assert.equal(p.manifest.sounds.length, 4);
  assert.deepEqual(p.manifest.sounds[3].settings, { playMode: 'loop' });
  assert.equal(p.manifest.sounds[3].fileName, 'rain.mp3');
});

test('removing a sound keeps the others on their files and fixes group members', () => {
  const p = removeSoundAt(imported(), 0);
  assert.deepEqual(p.sounds.map((s, i) => soundFile(s, i)), ['1.ogg', '2.ogg']);
  assert.deepEqual(p.manifest.sounds.map((s) => s.name), ['Gull', 'Wind']);
  // Sky (1, 2) moves down to (0, 1); Sea lost its only member but stays.
  assert.deepEqual(p.manifest.groups, [{ name: 'Sky', soundIndexes: [0, 1] }, { name: 'Sea', soundIndexes: [] }]);
  // Gull keeps its own settings, now at index 0.
  assert.equal(p.manifest.sounds[0].settings.scatter.minGapSeconds, 5);
});

test('a sound turned off plays silent but keeps its volume', () => {
  const p = setSoundOn(imported(), 0, false);
  assert.equal(p.sounds[0].off, true);
  assert.equal(playedVolume(p.sounds[0]), 0);
  assert.equal(p.sounds[0].volume, 0.5);
  assert.equal(playedVolume(setSoundOn(p, 0, true).sounds[0]), 0.5);
});

test('renaming a sound changes its name in the mix and manifest, not its file', () => {
  const p = renameSoundAt(imported(), 1, '  Seagull  ');
  assert.equal(p.sounds[1].name, 'Seagull');
  assert.equal(p.manifest.sounds[1].name, 'Seagull');
  assert.equal(p.manifest.sounds[1].bundleName, 'gull.opus');
  assert.equal(p.sounds[0].name, 'Waves');
  assert.equal(renameSoundAt(imported(), 1, '   ').sounds[1].name, 'Gull');
  assert.equal(renameSoundAt(imported(), 9, 'x').sounds.length, 3);
});

test('file names are readable, unique ignoring case, and pass the desktop check', () => {
  assert.equal(audioFileName('Rain', 'mp3', []), 'Rain.mp3');
  assert.equal(audioFileName('Rain', 'mp3', ['rain.MP3']), 'Rain (1).mp3');
  assert.equal(audioFileName('Rain', 'mp3', ['Rain.mp3', 'Rain (1).mp3']), 'Rain (2).mp3');
  const odd = audioFileName('a/b:c..d|e', 'wav', []);
  assert.ok(!/[\\/:*?"<>|]/.test(odd) && !odd.includes('..'), odd);
  assert.equal(audioFileName('  ', 'ogg', []), 'Sound.ogg');
  assert.equal(audioFileName('Fogueira à noite', 'flac', []), 'Fogueira à noite.flac');
});

test('new mixes get a free name', () => {
  assert.equal(uniqueName('New mix', []), 'New mix');
  assert.equal(uniqueName('New mix', ['new mix', 'New mix 2']), 'New mix 3');
});

test('a shared mix reads back on the phone with its volumes and off sounds', () => {
  let p = { ...imported(), name: 'Beach night' };
  p = appendSound(p, rain, 'Rain.mp3');
  p = setSoundOn(p, 1, false);
  p.sounds[0] = { ...p.sounds[0], volume: 0.9 };
  const { manifest, audio } = shareManifest(p, '2026-10-18T00:00:00.000Z');
  assert.deepEqual(audio.map((a) => a.zipName), ['audio/0.ogg', 'audio/1.ogg', 'audio/2.ogg', 'audio/Rain.mp3']);
  assert.equal(manifest.name, 'Beach night');
  const read = readPhonePreset(JSON.stringify(manifest), ['preset.json', ...audio.map((a) => a.zipName)]);
  assert.equal(read.ok, true);
  assert.equal(read.preset.sounds[0].volume, 0.9);
  assert.equal(read.preset.sounds[1].off, true);
  assert.equal(read.preset.sounds[2].off, undefined);
  assert.equal(read.preset.sounds[3].name, 'Rain');
  assert.deepEqual(read.preset.manifest.groups, p.manifest.groups);
});

test('an empty mix is a phone preset', () => {
  const m = emptyManifest('Night');
  assert.equal(m.format, 'noctivago-preset');
  assert.deepEqual(m.phone, { version: 1 });
  assert.deepEqual(m.sounds, []);
});

test('memory estimate: 10 minutes is about 220 MB', () => {
  assert.equal(Math.round(decodedMb([{ durationSeconds: 600 }])), 220);
  assert.equal(decodedMb([{ durationSeconds: null }]), 0);
});

test('a mix card lists its first sounds that are on', () => {
  const s = (name, off) => ({ name, off });
  assert.equal(soundsSummary([]), 'No sounds yet');
  assert.equal(soundsSummary([s('Rain'), s('Fire', true), s('Wind')]), 'Rain · Wind');
  assert.equal(soundsSummary([s('A'), s('B'), s('C'), s('D'), s('E')]), 'A · B · C +2');
  assert.equal(soundsSummary([s('A', true)]), '1 sound, all off');
});

test('duplicateSoundAt copies a sound with its settings and its own file', () => {
  const base = imported();
  const next = duplicateSoundAt(base, 1, 'Gull copy.opus');
  assert.equal(next.sounds.length, 4);
  assert.equal(next.sounds[3].name, 'Gull copy');
  assert.equal(next.sounds[3].file, 'Gull copy.opus');
  assert.equal(next.sounds[3].volume, 0.4);
  assert.equal(next.sounds[3].playMode, 'scatter');
  assert.equal(next.sounds[1].file, '1.ogg');
  assert.equal(duplicateSoundAt(base, 9, 'x.opus'), base);
});

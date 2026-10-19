import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freesoundSource, isFreesoundUrl, licenseLabel, parseSearch, previewFileName, searchError, searchUrl } from '../src/library/domain/freesound.ts';
import { appendSound } from '../src/player/domain/mixEdit.ts';

test('a search builds the desktop query with the token', () => {
  const url = new URL(searchUrl('  heavy rain ', 2, 'tok'));
  assert.equal(url.origin + url.pathname, 'https://freesound.org/apiv2/search/text/');
  assert.equal(url.searchParams.get('query'), 'heavy rain');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('page_size'), '15');
  assert.equal(url.searchParams.get('token'), 'tok');
});

test('an empty search makes no request', () => {
  assert.equal(searchUrl('   ', 1, 'tok'), null);
});

test('results without a preview are dropped; the HQ preview is preferred', () => {
  const page = parseSearch({
    count: 40,
    next: 'https://freesound.org/apiv2/search/text/?page=2',
    results: [
      { id: 1, name: 'rain.wav', username: 'ann', duration: 61.5, license: 'http://creativecommons.org/licenses/by/4.0/', tags: ['rain'], previews: { 'preview-hq-mp3': 'https://cdn.freesound.org/hq.mp3', 'preview-lq-mp3': 'https://cdn.freesound.org/lq.mp3' } },
      { id: 2, name: 'no preview', previews: {} },
    ],
  });
  assert.equal(page.results.length, 1);
  assert.equal(page.results[0].previewUrl, 'https://cdn.freesound.org/hq.mp3');
  assert.equal(page.results[0].pageUrl, 'https://freesound.org/s/1/');
  assert.equal(page.hasMore, true);
  assert.equal(page.count, 40);
});

test('the token only goes to freesound.org', () => {
  assert.equal(isFreesoundUrl('https://cdn.freesound.org/previews/1/1-hq.mp3'), true);
  assert.equal(isFreesoundUrl('https://freesound.org.evil.com/x.mp3'), false);
  assert.equal(isFreesoundUrl('not a link'), false);
});

test('license links read as short labels', () => {
  assert.equal(licenseLabel('http://creativecommons.org/publicdomain/zero/1.0/'), 'CC0');
  assert.equal(licenseLabel('https://creativecommons.org/licenses/by-nc/4.0/'), 'CC BY-NC');
  assert.equal(licenseLabel('http://creativecommons.org/licenses/sampling+/1.0/'), 'Sampling+');
  assert.equal(licenseLabel(''), '');
});

test('rate limit and server errors get plain messages', () => {
  assert.match(searchError(429), /rate limit/);
  assert.match(searchError(503), /down for now/);
  assert.match(searchError(401, 'Invalid token'), /401.*Invalid token/);
});

test('a preview is stored as MP3 under the sound name', () => {
  assert.equal(previewFileName('Rain on roof.wav'), 'Rain on roof.mp3');
  assert.equal(previewFileName('   '), 'Freesound sound.mp3');
});

test('the credit matches the desktop source and travels into a shared mix', () => {
  const r = parseSearch({ results: [{ id: 7, name: 'Owls', username: 'bo', license: 'L', description: ' a  b ', tags: ['owl'], previews: { 'preview-lq-mp3': 'https://cdn.freesound.org/7.mp3' } }] }).results[0];
  const source = freesoundSource(r, 123);
  assert.deepEqual(source, { type: 'freesound', freesoundId: 7, username: 'bo', license: 'L', pageUrl: 'https://freesound.org/s/7/', title: 'Owls', description: 'a b', tags: ['owl'], importedAt: 123 });
  const mix = appendSound({ name: 'Mix', sounds: [], manifest: { sounds: [] } }, { name: 'Owls', fileName: 'Owls.mp3', durationSeconds: 3, source }, 'Owls.mp3');
  assert.deepEqual(mix.manifest.sounds[0].source, source);
});

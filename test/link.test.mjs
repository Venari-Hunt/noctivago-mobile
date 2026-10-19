import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLink } from '../src/library/domain/link.ts';

test('a direct audio link is accepted as is', () => {
  assert.deepEqual(checkLink('  https://example.com/rain.mp3 '), { ok: true, url: 'https://example.com/rain.mp3' });
});

test('a link without https:// gets it', () => {
  assert.deepEqual(checkLink('example.com/sounds/rain.ogg'), { ok: true, url: 'https://example.com/sounds/rain.ogg' });
});

test('empty text, non-links and other schemes are refused', () => {
  assert.equal(checkLink('   ').ok, false);
  assert.equal(checkLink('rain sound').ok, false);
  assert.equal(checkLink('ftp://example.com/rain.mp3').ok, false);
  assert.equal(checkLink('file:///sdcard/rain.mp3').ok, false);
});

test('video and music site links point to the PC app', () => {
  for (const link of ['https://www.youtube.com/watch?v=abc', 'youtu.be/abc', 'https://m.youtube.com/watch?v=abc', 'https://soundcloud.com/a/b', 'https://artist.bandcamp.com/track/x']) {
    const result = checkLink(link);
    assert.equal(result.ok, false, link);
    assert.match(result.error, /PC app/);
  }
});

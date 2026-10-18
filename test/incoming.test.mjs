import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incomingFileUri, sharedFiles } from '../src/player/domain/incoming.ts';

test('"Open with" hands over the file itself', () => {
  const uri = 'content://com.whatsapp.provider.media/item/123';
  assert.equal(incomingFileUri(uri), uri);
  assert.equal(incomingFileUri('file:///sdcard/Download/Beach.ncvpreset'), 'file:///sdcard/Download/Beach.ncvpreset');
});

test('plain launches and the share link are not files', () => {
  assert.equal(incomingFileUri(null), null);
  assert.equal(incomingFileUri('noctivago:///'), null);
  assert.equal(incomingFileUri('noctivago://expo-sharing'), null);
  assert.equal(incomingFileUri('https://example.com'), null);
});

test('shared files are the non-text payloads, with resolved names', () => {
  const payloads = [
    { shareType: 'text', value: 'hi' },
    { shareType: 'file', value: 'content://x/1' },
    { shareType: 'audio', value: 'content://x/2', mimeType: 'audio/*' },
  ];
  const resolved = [{ value: 'content://x/2', originalName: 'Rain.mp3', contentMimeType: 'audio/mpeg' }];
  assert.deepEqual(sharedFiles(payloads, resolved), [
    { uri: 'content://x/1', name: null, mimeType: null },
    { uri: 'content://x/2', name: 'Rain.mp3', mimeType: 'audio/mpeg' },
  ]);
  assert.deepEqual(sharedFiles([{ shareType: 'url', value: 'https://a' }]), []);
  assert.deepEqual(sharedFiles([]), []);
});

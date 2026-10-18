import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incomingFileUri, sharedFileUri } from '../src/player/domain/incoming.ts';

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

test('the shared file is the first non-text payload', () => {
  assert.equal(
    sharedFileUri([{ shareType: 'text', value: 'hi' }, { shareType: 'file', value: 'content://x/1' }]),
    'content://x/1',
  );
  assert.equal(sharedFileUri([{ shareType: 'url', value: 'https://a' }]), null);
  assert.equal(sharedFileUri([]), null);
});

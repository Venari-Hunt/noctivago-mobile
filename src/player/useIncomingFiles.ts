import { useIncomingShare } from 'expo-sharing';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { incomingFileUri, sharedFileUris } from './domain/incoming';

// Calls onFile with the URI of each file another app handed over: tapping a
// .ncvpreset or a sound and choosing Noctívago ("Open with"), or Share →
// Noctívago (one file or several).
// Android filters: app.json (android.intentFilters, expo-sharing plugin).
export function useIncomingFiles(onFile: (uri: string) => void) {
  const callback = useRef(onFile);
  callback.current = onFile;

  useEffect(() => {
    const handle = (url: string | null | undefined) => {
      const uri = incomingFileUri(url);
      if (uri) callback.current(uri);
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();
  useEffect(() => {
    const uris = sharedFileUris(sharedPayloads);
    if (uris.length === 0) return;
    clearSharedPayloads();
    uris.forEach((uri) => callback.current(uri));
  }, [sharedPayloads]);
}

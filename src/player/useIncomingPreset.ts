import { useIncomingShare } from 'expo-sharing';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { incomingFileUri, sharedFileUri } from './domain/incoming';

// Calls onFile with the URI of a file another app handed over: tapping a
// .ncvpreset and choosing Noctívago ("Open with"), or Share → Noctívago.
// Android filters: app.json (android.intentFilters, expo-sharing plugin).
export function useIncomingPreset(onFile: (uri: string) => void) {
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
    const uri = sharedFileUri(sharedPayloads);
    if (!uri) return;
    clearSharedPayloads();
    callback.current(uri);
  }, [sharedPayloads]);
}

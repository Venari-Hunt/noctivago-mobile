import { useIncomingShare } from 'expo-sharing';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { incomingFileUri, sharedFiles, type IncomingFile } from './domain/incoming';

// Calls onFile with the URI of each file another app handed over: tapping a
// .ncvpreset or a sound and choosing Noctívago ("Open with"), or Share →
// Noctívago (one file or several).
// Android filters: app.json (android.intentFilters, expo-sharing plugin).
export function useIncomingFiles(onFile: (file: IncomingFile) => void) {
  const callback = useRef(onFile);
  callback.current = onFile;

  useEffect(() => {
    const handle = (url: string | null | undefined) => {
      const uri = incomingFileUri(url);
      if (uri) callback.current({ uri, name: null, mimeType: null });
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  // Waits for expo-sharing to resolve the payloads: that is where the
  // files' real names and types come from.
  const { sharedPayloads, resolvedSharedPayloads, isResolving, clearSharedPayloads } = useIncomingShare();
  useEffect(() => {
    if (isResolving) return;
    const files = sharedFiles(sharedPayloads, resolvedSharedPayloads);
    if (files.length === 0) return;
    clearSharedPayloads();
    files.forEach((file) => callback.current(file));
  }, [sharedPayloads, resolvedSharedPayloads, isResolving]);
}

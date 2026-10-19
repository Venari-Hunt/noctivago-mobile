import { File } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Home, type HomeTab } from './src/home/components/Home';
import { addSummary, incomingFileName, isAudioFile } from './src/library/domain/library';
import { PreviewPlayer } from './src/library/preview';
import { addFiles } from './src/library/storage';
import { Player } from './src/player/components/Player';
import { PlayerEngine } from './src/player/engine';
import { printNightLog } from './src/player/nightLog';
import { importFromUri, type SavedPreset } from './src/player/storage';
import { useIncomingFiles } from './src/player/useIncomingFiles';
import { SettingsScreen } from './src/settings/components/SettingsScreen';
import { useSettings } from './src/settings/store';
import { useAutoUpdate } from './src/updates/useAutoUpdate';

// Three screens, so plain state instead of a router: home (Mixes, Sounds
// and Community tabs), Settings, and the player for one preset. Leaving the player stops playback.
// A preset opened from another app is imported and goes straight to the
// player; a sound goes into the library.
export default function App() {
  const engine = useRef(new PlayerEngine());
  const preview = useRef(new PreviewPlayer());
  const [open, setOpen] = useState<SavedPreset | null>(null);
  const [tab, setTab] = useState<HomeTab>('mixes');
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const update = useAutoUpdate(playing, useSettings().autoInstallUpdates);
  // Hands the saved night log to `adb logcat` (scripts/night-report.mjs).
  useEffect(printNightLog, []);

  const openPreset = async (preset: SavedPreset) => {
    await preview.current.stop();
    setOpen(preset);
  };

  useIncomingFiles((file) => {
    const { uri } = file;
    if (isAudioFile(incomingFileName(file.name, uri), file.mimeType ?? fileTypeOf(uri))) {
      addFiles([{ ...file, mimeType: file.mimeType ?? fileTypeOf(uri) }])
        .then((result) => {
          setLibraryVersion((v) => v + 1);
          setTab('sounds');
          if (result.added.length === 0) Alert.alert("Couldn't add that sound", addSummary(0, result.failed));
        })
        .catch((e) => Alert.alert("Couldn't add that sound", e instanceof Error ? e.message : String(e)));
      return;
    }
    importFromUri(uri)
      .then(openPreset)
      .catch((e) => Alert.alert("Couldn't import that file", e instanceof Error ? e.message : String(e)));
  });
  const version = `${update.label}${update.waiting ? ` · ${update.waiting}` : ''}`;

  return (
    <>
      {open ? (
        <Player key={open.id} engine={engine.current} initial={open} onPlayingChange={setPlaying} onBack={() => setOpen(null)} />
      ) : settingsOpen ? (
        <SettingsScreen update={update} onBack={() => setSettingsOpen(false)} />
      ) : (
        <Home
          version={version}
          tab={tab}
          onTab={(next) => {
            preview.current.stop().catch(() => {});
            setTab(next);
          }}
          preview={preview.current}
          libraryVersion={libraryVersion}
          onOpen={openPreset}
          onSettings={() => {
            preview.current.stop().catch(() => {});
            setSettingsOpen(true);
          }}
        />
      )}
      <StatusBar style="light" />
    </>
  );
}

function fileTypeOf(uri: string): string | null {
  try {
    return new File(uri).type || null;
  } catch {
    return null;
  }
}

import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Player } from './src/player/components/Player';
import { PresetList } from './src/player/components/PresetList';
import { PlayerEngine } from './src/player/engine';
import { importFromUri, type SavedPreset } from './src/player/storage';
import { useIncomingPreset } from './src/player/useIncomingPreset';
import { useAutoUpdate } from './src/updates/useAutoUpdate';

// Two screens, so plain state instead of a router: the preset list, and the
// player for one preset. Leaving the player stops playback. A preset file
// opened from another app is imported and goes straight to the player.
export default function App() {
  const engine = useRef(new PlayerEngine());
  const [open, setOpen] = useState<SavedPreset | null>(null);
  const [playing, setPlaying] = useState(false);
  const update = useAutoUpdate(playing);
  useIncomingPreset((uri) => {
    importFromUri(uri)
      .then(setOpen)
      .catch((e) => Alert.alert("Couldn't import that file", e instanceof Error ? e.message : String(e)));
  });
  const version = `${update.label}${update.updateWaiting ? ' · new version ready, pause to load it' : ''}`;

  return (
    <>
      {open ? (
        <Player key={open.id} engine={engine.current} initial={open} onPlayingChange={setPlaying} onBack={() => setOpen(null)} />
      ) : (
        <PresetList version={version} onOpen={setOpen} />
      )}
      <StatusBar style="light" />
    </>
  );
}

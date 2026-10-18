import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Player } from './src/player/components/Player';
import { PresetList } from './src/player/components/PresetList';
import { PlayerEngine } from './src/player/engine';
import type { SavedPreset } from './src/player/storage';
import { useAutoUpdate } from './src/updates/useAutoUpdate';

// Two screens, so plain state instead of a router: the preset list, and the
// player for one preset. Leaving the player stops playback.
export default function App() {
  const engine = useRef(new PlayerEngine());
  const [open, setOpen] = useState<SavedPreset | null>(null);
  const [playing, setPlaying] = useState(false);
  const update = useAutoUpdate(playing);
  const version = `${update.label}${update.updateWaiting ? ' · new version ready, pause to load it' : ''}`;

  return (
    <>
      {open ? (
        <Player engine={engine.current} initial={open} onPlayingChange={setPlaying} onBack={() => setOpen(null)} />
      ) : (
        <PresetList version={version} onOpen={setOpen} />
      )}
      <StatusBar style="light" />
    </>
  );
}

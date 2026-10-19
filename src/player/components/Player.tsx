import * as Battery from 'expo-battery';
import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LibrarySound } from '../../library/domain/library';
import { ActionMenu } from '../../ui/ActionMenu';
import { clockReport, type ClockSample } from '../domain/clockCheck';
import { decodedMb, HEAVY_MIX_MB, playedVolume, setSoundOn, soundFile } from '../domain/mixEdit';
import type { PlayerEngine } from '../engine';
import { addLibrarySounds, removeSound, savePreset, type SavedPreset } from '../storage';
import { AddSoundsSheet } from './AddSoundsSheet';
import { PresetMenu } from './PresetMenu';
import { SleepTimerRow } from './SleepTimerRow';
import { VolumeRow } from './VolumeRow';
import { colors, shared } from './theme';

type Props = {
  engine: PlayerEngine;
  initial: SavedPreset;
  onPlayingChange: (playing: boolean) => void;
  onBack: () => void;
};

type Run = { samples: ClockSample[]; batteryStart: number; batteryNow: number };

const MODE_NOTE = { loop: undefined, scatter: 'Random Interval', scheduled: 'Scheduled' } as const;

// One mix, like the desktop Mixer: play it, set volumes, add your own
// sounds, turn sounds off or remove them. Every change is saved right away.
export function Player({ engine, initial, onPlayingChange, onBack }: Props) {
  const [preset, setPreset] = useState(initial);
  const [loading, setLoading] = useState<string | null>('Loading sounds…');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [soundMenu, setSoundMenu] = useState<number | null>(null);
  const playingRef = useRef(false);

  const setPlayingBoth = (on: boolean) => {
    playingRef.current = on;
    setPlaying(on);
    onPlayingChange(on);
  };

  const play = async () => {
    await engine.play();
    setPlayingBoth(true);
    const battery = await Battery.getBatteryLevelAsync();
    setRun({ samples: [{ wallMs: Date.now(), audioSec: engine.currentTime }], batteryStart: battery, batteryNow: battery });
  };
  const pause = async () => {
    await engine.pause();
    setPlayingBoth(false);
    setSleepEndsAt(null); // pausing turns the timer off
  };
  const pickSleep = async (minutes: number) => {
    if (!playingRef.current) await play();
    engine.setSleepTimer(minutes * 60);
    setSleepEndsAt(Date.now() + minutes * 60000);
    setSleepMinutes(minutes);
  };
  const sleepOff = () => {
    engine.cancelSleepTimer(true);
    setSleepEndsAt(null);
  };

  useEffect(() => {
    engine.onRemote = (cmd) => {
      if (cmd === 'play' && !playingRef.current) play().catch(() => {});
      if (cmd === 'pause' && playingRef.current) pause().catch(() => {});
    };
    engine.onSleepEnd = () => {
      pause().catch(() => {});
    };
    engine
      .load(initial, (done, total) => setLoading(`Loading sounds… ${done} of ${total}`))
      .then(() => setLoading(null))
      .catch((e) => setError(`Couldn't load this preset: ${e instanceof Error ? e.message : String(e)}`));
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => {
      back.remove();
      engine.onRemote = () => {};
      engine.onSleepEnd = () => {};
      engine.unload().catch(() => {});
      onPlayingChange(false);
    };
  }, []);

  // Audio clock vs wall clock and battery drain, from the spike: the quick
  // check that playback survived the screen being off.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(async () => {
      const sample = { wallMs: Date.now(), audioSec: engine.currentTime };
      const batteryNow = await Battery.getBatteryLevelAsync();
      setRun((r) => (r ? { ...r, samples: [...r.samples, sample], batteryNow } : r));
    }, 10000);
    return () => clearInterval(id);
  }, [playing]);

  const update = (next: SavedPreset) => setPreset(next);
  const save = (next: SavedPreset) => {
    setPreset(next);
    savePreset(next);
  };
  const withMaster = (v: number) => ({ ...preset, master: v });
  const withSound = (i: number, v: number) => ({
    ...preset,
    sounds: preset.sounds.map((s, j) => (j === i ? { ...s, volume: v } : s)),
  });
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  // Copied into the mix, then playing right away (fading in) if the mix is.
  const addSounds = async (sounds: LibrarySound[]) => {
    setPicking(false);
    setAdding('Adding sounds…');
    try {
      const before = preset.sounds.length;
      const next = await addLibrarySounds(preset, sounds);
      setPreset(next);
      for (let i = before; i < next.sounds.length; i++) {
        setAdding(`Loading sounds… ${i - before + 1} of ${next.sounds.length - before}`);
        await engine.addSound(next, i);
      }
    } catch (e) {
      fail(e);
    } finally {
      setAdding(null);
    }
  };

  const toggleSound = (i: number) => {
    const next = setSoundOn(preset, i, !!preset.sounds[i].off);
    engine.setSoundVolume(soundFile(next.sounds[i], i), playedVolume(next.sounds[i]));
    save(next);
  };

  const confirmRemove = (i: number) => {
    const sound = preset.sounds[i];
    Alert.alert(
      `Remove "${sound.name}" from this mix?`,
      'A sound from your library can be added again. One that came in an imported preset is gone until you import the preset again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            engine.removeSound(soundFile(sound, i));
            setPreset(removeSound(preset, i));
          },
        },
      ],
    );
  };

  const report = run && clockReport(run.samples);
  const drain = report && report.wallMinutes > 5 ? ((run.batteryStart - run.batteryNow) * 6000) / report.wallMinutes : null;
  const empty = preset.sounds.length === 0;
  const heavyMb = decodedMb(preset.sounds);
  const menuSound = soundMenu === null ? null : preset.sounds[soundMenu];

  return (
    <View style={shared.page}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.link}>‹ Mixes</Text>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityLabel="Mix options">
          <Text style={styles.dots}>⋯</Text>
        </Pressable>
      </View>
      <Text style={shared.title}>{preset.name}</Text>
      {error && <Text style={shared.error}>{error}</Text>}
      {note && <Text style={styles.note}>{note}</Text>}
      <Pressable
        style={[shared.button, playing && styles.on, (loading || error || empty) && styles.disabled]}
        disabled={!!loading || !!error || empty}
        onPress={() => (playing ? pause() : play()).catch((e) => setError(String(e)))}
      >
        <Text style={[shared.buttonText, playing && styles.onText]}>{loading ?? (playing ? 'Pause' : 'Play')}</Text>
      </Pressable>
      <SleepTimerRow
        endsAt={sleepEndsAt}
        minutes={sleepMinutes}
        disabled={!!loading || !!error || empty}
        onPick={(m) => pickSleep(m).catch((e) => setError(String(e)))}
        onOff={sleepOff}
      />
      <VolumeRow
        label="Master volume"
        value={preset.master}
        onChange={(v) => {
          engine.setMasterVolume(v, playingRef.current);
          update(withMaster(v));
        }}
        onDone={(v) => save(withMaster(v))}
      />
      <Pressable
        style={[shared.secondary, (!!loading || !!adding) && styles.disabled]}
        disabled={!!loading || !!adding}
        onPress={() => setPicking(true)}
      >
        <Text style={shared.secondaryText}>{adding ?? 'Add sounds'}</Text>
      </Pressable>
      {heavyMb > HEAVY_MIX_MB && (
        <Text style={styles.note}>Heavy mix: about {Math.round(heavyMb)} MB of memory while playing. Long sounds take the most.</Text>
      )}
      <ScrollView contentContainerStyle={styles.sounds}>
        {empty && (
          <Text style={shared.help}>
            No sounds yet. Tap Add sounds to pick some from your library. Hold a sound's name to turn it off or remove it.
          </Text>
        )}
        {preset.sounds.map((s, i) => (
          <VolumeRow
            key={soundFile(s, i)}
            label={s.name}
            value={s.volume}
            off={s.off}
            note={s.off ? 'Off' : MODE_NOTE[s.playMode]}
            onChange={(v) => {
              if (!s.off) engine.setSoundVolume(soundFile(s, i), v);
              update(withSound(i, v));
            }}
            onDone={(v) => save(withSound(i, v))}
            onLongPress={() => setSoundMenu(i)}
          />
        ))}
      </ScrollView>
      {report && (
        <Text style={shared.small}>
          Audio kept running {(report.ratio * 100).toFixed(0)}% of {report.wallMinutes.toFixed(0)} min · battery{' '}
          {drain === null ? 'measuring…' : `${drain.toFixed(1)}% per hour`}
        </Text>
      )}
      <AddSoundsSheet visible={picking} onAdd={(sounds) => addSounds(sounds)} onClose={() => setPicking(false)} />
      <ActionMenu
        title={menuSound?.name ?? null}
        actions={
          soundMenu === null || !menuSound
            ? []
            : [
                { label: menuSound.off ? 'Turn on' : 'Turn off', onPress: () => toggleSound(soundMenu) },
                { label: 'Remove from mix', destructive: true, onPress: () => confirmRemove(soundMenu) },
              ]
        }
        onClose={() => setSoundMenu(null)}
      />
      <PresetMenu
        preset={menu ? preset : null}
        onClose={() => setMenu(false)}
        onRenamed={(next) => {
          setPreset(next);
          engine.setTitle(next.name);
        }}
        onCopied={(copy) => setNote(`Saved a copy: "${copy.name}", in Mixes.`)}
        onDeleted={onBack}
        onError={setError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.accent, fontSize: 16 },
  dots: { color: colors.accent, fontSize: 24, paddingHorizontal: 6 },
  note: { color: colors.dim, fontSize: 14 },
  on: { backgroundColor: colors.raised },
  onText: { color: colors.accent },
  disabled: { opacity: 0.5 },
  sounds: { gap: 14, paddingBottom: 24 },
});

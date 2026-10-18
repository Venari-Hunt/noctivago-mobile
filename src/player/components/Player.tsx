import * as Battery from 'expo-battery';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { clockReport, type ClockSample } from '../domain/clockCheck';
import type { PlayerEngine } from '../engine';
import { savePreset, type SavedPreset } from '../storage';
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

export function Player({ engine, initial, onPlayingChange, onBack }: Props) {
  const [preset, setPreset] = useState(initial);
  const [loading, setLoading] = useState<string | null>('Loading sounds…');
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
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

  const report = run && clockReport(run.samples);
  const drain = report && report.wallMinutes > 5 ? ((run.batteryStart - run.batteryNow) * 6000) / report.wallMinutes : null;

  return (
    <View style={shared.page}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Presets</Text>
      </Pressable>
      <Text style={shared.title}>{preset.name}</Text>
      {error && <Text style={shared.error}>{error}</Text>}
      <Pressable
        style={[shared.button, playing && styles.on, (loading || error) && styles.disabled]}
        disabled={!!loading || !!error}
        onPress={() => (playing ? pause() : play()).catch((e) => setError(String(e)))}
      >
        <Text style={[shared.buttonText, playing && styles.onText]}>{loading ?? (playing ? 'Pause' : 'Play')}</Text>
      </Pressable>
      <SleepTimerRow
        endsAt={sleepEndsAt}
        minutes={sleepMinutes}
        disabled={!!loading || !!error}
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
      <ScrollView contentContainerStyle={styles.sounds}>
        {preset.sounds.map((s, i) => (
          <VolumeRow
            key={i}
            label={s.name}
            value={s.volume}
            note={MODE_NOTE[s.playMode]}
            onChange={(v) => {
              engine.setSoundVolume(i, v);
              update(withSound(i, v));
            }}
            onDone={(v) => save(withSound(i, v))}
          />
        ))}
      </ScrollView>
      {report && (
        <Text style={shared.small}>
          Audio kept running {(report.ratio * 100).toFixed(0)}% of {report.wallMinutes.toFixed(0)} min · battery{' '}
          {drain === null ? 'measuring…' : `${drain.toFixed(1)}% per hour`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.accent, fontSize: 16 },
  on: { backgroundColor: colors.raised },
  onText: { color: colors.accent },
  disabled: { opacity: 0.5 },
  sounds: { gap: 14, paddingBottom: 24 },
});

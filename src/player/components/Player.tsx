import * as Battery from 'expo-battery';
import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LibrarySound } from '../../library/domain/library';
import { fadeLabel } from '../../settings/domain/settings';
import { getSettings, useSettings } from '../../settings/store';
import { ActionMenu, type Action } from '../../ui/ActionMenu';
import { BottomSheet } from '../../ui/BottomSheet';
import { TextPrompt } from '../../ui/TextPrompt';
import { logError } from '../../errorLog';
import { clockReport, type ClockSample } from '../domain/clockCheck';
import { minutesUntilClock } from '../domain/sleepTimer';
import { addGroup, groupChangeNote, groupOfSound, groupsOf, setMember } from '../domain/groupEdit';
import { decodedMb, HEAVY_MIX_MB, playedVolume, renameSoundAt, setSoundOn, soundFile, uniqueName } from '../domain/mixEdit';
import type { PlayerEngine } from '../engine';
import { addLibrarySounds, duplicateSound, removeSound, savePreset, type SavedPreset } from '../storage';
import { AddSoundsSheet } from './AddSoundsSheet';
import { GroupChips } from './GroupChips';
import { GroupSheet } from './GroupSheet';
import { ShotSheet } from './ShotSheet';
import { PresetMenu } from './PresetMenu';
import { SleepTimerRow } from './SleepTimerRow';
import { SoundCard } from './SoundCard';
import { DEFAULT_VOLUME } from '../../shared/volumeScale.js';
import { TransportBar } from './TransportBar';
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
// sounds, turn sounds off or remove them, put them in Sound Groups. Every
// change is saved right away. The sounds scroll; Play, the sleep timer,
// master volume and Add sounds stay in a bar at the bottom.
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
  const [timerSheet, setTimerSheet] = useState(false);
  /** The "stop at a time" dialog is open. */
  const [timerAt, setTimerAt] = useState(false);
  const { showPlaybackCheck } = useSettings();
  const [soundMenu, setSoundMenu] = useState<number | null>(null);
  const [groupSheet, setGroupSheet] = useState<number | null>(null);
  /** The sound whose play mode sheet is open. */
  const [modeSheet, setModeSheet] = useState<number | null>(null);
  /** A just-made group opens with its sound list already showing. */
  const [pickFirst, setPickFirst] = useState(false);
  /** The sound being renamed (its name dialog is open). */
  const [renaming, setRenaming] = useState<number | null>(null);
  /** The "New group" name dialog; soundIndex joins the new group. */
  const [naming, setNaming] = useState<{ soundIndex?: number } | null>(null);
  const playingRef = useRef(false);

  const setPlayingBoth = (on: boolean) => {
    playingRef.current = on;
    setPlaying(on);
    onPlayingChange(on);
  };

  // Play starts the timer from Settings ("Start a timer on Play") unless
  // one was just picked.
  const play = async (autoTimer = true) => {
    await engine.play();
    setPlayingBoth(true);
    const auto = getSettings().sleepAutoMinutes;
    if (autoTimer && auto > 0) startSleep(auto);
    const battery = await Battery.getBatteryLevelAsync();
    setRun({ samples: [{ wallMs: Date.now(), audioSec: engine.currentTime }], batteryStart: battery, batteryNow: battery });
  };
  const pause = async () => {
    await engine.pause();
    setPlayingBoth(false);
    setSleepEndsAt(null); // pausing turns the timer off
  };
  const startSleep = (minutes: number) => {
    engine.setSleepTimer(minutes * 60, getSettings().sleepFadeSeconds);
    setSleepEndsAt(Date.now() + minutes * 60000);
    setSleepMinutes(minutes);
  };
  const pickSleep = async (minutes: number) => {
    if (!playingRef.current) await play(false);
    startSleep(minutes);
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
      .catch((e) => {
        logError('load preset', e);
        setError(`Couldn't load this preset: ${e instanceof Error ? e.message : String(e)}`);
      });
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
  const fail = (e: unknown, where = 'player') => {
    logError(where, e);
    setError(e instanceof Error ? e.message : String(e));
  };

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

  // A copy with the same settings and its own audio file, added at the end.
  const duplicate = async (i: number) => {
    if (adding) return; // a second tap while one copy is still loading
    setAdding('Duplicating…');
    try {
      const next = await duplicateSound(preset, i);
      setPreset(next);
      await engine.addSound(next, next.sounds.length - 1);
      setNote(`Added "${next.sounds[next.sounds.length - 1].name}".`);
    } catch (e) {
      fail(e, 'duplicate');
    } finally {
      setAdding(null);
    }
  };

  // A new play mode or shot setting: saved, and the sound rebuilt with it
  // (a shot sound reads its settings when it is built).
  const reshape = async (next: SavedPreset, i: number) => {
    save(next);
    try {
      engine.removeSound(soundFile(next.sounds[i], i));
      await engine.addSound(next, i);
    } catch (e) {
      fail(e, 'play mode');
    }
  };

  // Sound Group edits play right away (engine.regroup) and are saved.
  const regroup = (next: SavedPreset) => {
    const said = groupChangeNote(preset, next);
    if (said) setNote(said);
    engine.regroup(next);
    save(next);
  };

  const newGroup = (name: string) => {
    const soundIndex = naming?.soundIndex;
    setNaming(null);
    const next = addGroup(preset, name, soundIndex);
    regroup(next);
    // A group made from the Groups list opens to pick its sounds, list ready.
    if (soundIndex === undefined) {
      setPickFirst(true);
      setGroupSheet(groupsOf(next).length - 1);
    }
  };

  const toggleSound = (i: number) => {
    const next = setSoundOn(preset, i, !!preset.sounds[i].off);
    engine.setSoundVolume(soundFile(next.sounds[i], i), playedVolume(next.sounds[i]));
    save(next);
  };

  const resetVolume = (i: number) => {
    const next = withSound(i, DEFAULT_VOLUME);
    if (!next.sounds[i].off) engine.setSoundVolume(soundFile(next.sounds[i], i), DEFAULT_VOLUME);
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
  const groups = groupsOf(preset);
  const groupMenu = (i: number): Action[] => {
    const at = groupOfSound(preset, i);
    return [
      ...groups.map((g, gi) => ({
        label: gi === at ? `Leave "${g.name}"` : `Add to "${g.name}"`,
        onPress: () => regroup(setMember(preset, gi, i, gi !== at)),
      })),
      { label: 'New group with this sound…', onPress: () => setNaming({ soundIndex: i }) },
    ];
  };

  const blocked = !!loading || !!error || empty;
  const onCount = preset.sounds.filter((s) => !s.off).length;

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.head}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.link}>‹ Mixes</Text>
          </Pressable>
          <Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityLabel="Mix options">
            <Text style={styles.dots}>⋯</Text>
          </Pressable>
        </View>
        <Text style={shared.title} numberOfLines={2}>{preset.name}</Text>
        {!empty && (
          <Text style={shared.small}>
            {onCount === preset.sounds.length ? `${onCount} sound${onCount === 1 ? '' : 's'}` : `${onCount} of ${preset.sounds.length} sounds on`}
            {playing ? ' · playing' : ''}
          </Text>
        )}
        {error && <Text style={shared.error}>{error}</Text>}
        {note && <Text style={styles.note}>{note}</Text>}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.sounds}>
        {empty ? (
          <Text style={shared.help}>
            No sounds yet. Tap + Sounds below to pick some from your library. The round button on a sound turns it on or
            off; tap its ⋮ (or hold its name) to group it or remove it. Random Interval and Scheduled sounds get a small play button
            that plays one shot right away, to try their settings.
          </Text>
        ) : (
          <GroupChips groups={groups} onOpen={setGroupSheet} onNew={() => setNaming({})} />
        )}
        {preset.sounds.map((s, i) => (
          <SoundCard
            key={soundFile(s, i)}
            label={s.name}
            value={s.volume}
            off={s.off}
            note={soundNote(s.off ? 'Off' : MODE_NOTE[s.playMode] ?? `${Math.round(s.volume * 100)}%`, groups[groupOfSound(preset, i)]?.name)}
            onToggle={() => toggleSound(i)}
            onChange={(v) => {
              if (!s.off) engine.setSoundVolume(soundFile(s, i), v);
              update(withSound(i, v));
            }}
            onDone={(v) => save(withSound(i, v))}
            onLongPress={() => setSoundMenu(i)}
            onTest={
              s.playMode !== 'loop' && !loading
                ? () => engine.testShot(soundFile(s, i), s.volume, !s.off).catch(fail)
                : undefined
            }
          />
        ))}
        {heavyMb > HEAVY_MIX_MB && (
          <Text style={styles.note}>Heavy mix: about {Math.round(heavyMb)} MB of memory while playing. Long sounds take the most.</Text>
        )}
        {showPlaybackCheck && report && (
          <Text style={shared.small}>
            Audio kept running {(report.ratio * 100).toFixed(0)}% of {report.wallMinutes.toFixed(0)} min · battery{' '}
            {drain === null ? 'measuring…' : `${drain.toFixed(1)}% per hour`}
          </Text>
        )}
      </ScrollView>
      <TransportBar
        playing={playing}
        status={loading ?? adding}
        disabled={blocked}
        onPlayPause={() => (playing ? pause() : play()).catch((e) => fail(e, 'play/pause'))}
        master={preset.master}
        onMaster={(v) => {
          engine.setMasterVolume(v, playingRef.current);
          update(withMaster(v));
        }}
        onMasterDone={(v) => save(withMaster(v))}
        sleepEndsAt={sleepEndsAt}
        onTimer={() => setTimerSheet(true)}
        adding={!!loading || !!adding}
        onAdd={() => setPicking(true)}
      />
      <BottomSheet title="Sleep timer" visible={timerSheet} onClose={() => setTimerSheet(false)}>
        <SleepTimerRow
          endsAt={sleepEndsAt}
          minutes={sleepMinutes}
          disabled={blocked}
          onPick={(m) => {
            setTimerSheet(false);
            pickSleep(m).catch((e) => fail(e, 'sleep timer'));
          }}
          onAtTime={() => {
            setTimerSheet(false);
            setTimerAt(true);
          }}
          onOff={() => {
            setTimerSheet(false);
            sleepOff();
          }}
        />
        <Text style={shared.small}>Fades out over {fadeLabel(getSettings().sleepFadeSeconds)} at the end. Change it in Settings.</Text>
      </BottomSheet>
      <TextPrompt
        title={timerAt ? 'Stop playing at (24 h, like 06:30)' : null}
        initial=""
        placeholder="HH:MM"
        okLabel="Start"
        onOk={(text) => {
          setTimerAt(false);
          const minutes = minutesUntilClock(text);
          if (minutes === null) Alert.alert('Not a time', 'Use 24-hour time, like 06:30 or 23:15.');
          else pickSleep(minutes).catch((e) => fail(e, 'sleep timer'));
        }}
        onCancel={() => setTimerAt(false)}
      />
      <AddSoundsSheet visible={picking} onAdd={(sounds) => addSounds(sounds)} onClose={() => setPicking(false)} />
      <ActionMenu
        title={menuSound?.name ?? null}
        actions={
          soundMenu === null || !menuSound
            ? []
            : [
                { label: menuSound.off ? 'Turn on' : 'Turn off', onPress: () => toggleSound(soundMenu) },
                ...(menuSound.volume === DEFAULT_VOLUME
                  ? []
                  : [{ label: 'Reset volume', onPress: () => resetVolume(soundMenu) }]),
                { label: 'Play mode…', onPress: () => setModeSheet(soundMenu) },
                { label: 'Rename…', onPress: () => setRenaming(soundMenu) },
                { label: 'Duplicate', onPress: () => duplicate(soundMenu) },
                ...groupMenu(soundMenu),
                { label: 'Remove from mix', destructive: true, onPress: () => confirmRemove(soundMenu) },
              ]
        }
        onClose={() => setSoundMenu(null)}
      />
      <TextPrompt
        title={renaming === null ? null : 'Rename sound'}
        initial={renaming === null ? '' : preset.sounds[renaming]?.name ?? ''}
        okLabel="Save"
        onOk={(name) => {
          const i = renaming;
          setRenaming(null);
          if (i !== null) save(renameSoundAt(preset, i, name));
        }}
        onCancel={() => setRenaming(null)}
      />
      <ShotSheet preset={preset} index={modeSheet} onChange={reshape} onClose={() => setModeSheet(null)} />
      <GroupSheet
        preset={preset}
        index={groupSheet}
        startWithSounds={pickFirst}
        onChange={regroup}
        onClose={() => {
          setGroupSheet(null);
          setPickFirst(false);
        }}
      />
      <TextPrompt
        title={naming ? 'New Sound Group' : null}
        initial={uniqueName('Group', groups.map((g) => g.name))}
        okLabel="Create"
        onOk={newGroup}
        onCancel={() => setNaming(null)}
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

// What a sound row shows on the right, with its group in front.
function soundNote(base: string, group: string | undefined): string {
  return group ? `${group} · ${base}` : base;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  top: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 12, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  link: { color: colors.accent, fontSize: 16 },
  dots: { color: colors.accent, fontSize: 24, paddingHorizontal: 6 },
  note: { color: colors.dim, fontSize: 14 },
  scroll: { flex: 1 },
  sounds: { gap: 10, paddingHorizontal: 16, paddingBottom: 24 },
});

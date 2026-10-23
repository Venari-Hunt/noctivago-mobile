import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../ui/BottomSheet';
import { Choice } from '../../ui/Choice';
import { SliderRow } from '../../ui/SliderRow';
import { TextPrompt } from '../../ui/TextPrompt';
import type { PlayMode } from '../domain/presetFile';
import {
  addScheduleTime,
  durationText,
  removeScheduleTime,
  scatterGap,
  scheduleOf,
  setPlayMode,
  setScatterGap,
  setSchedule,
} from '../domain/shotEdit';
import type { SavedPreset } from '../storage';
import { colors, shared } from './theme';

// A sound's play mode, like the desktop's Remix "Playback": Loop, Random
// Interval (a shot after a random gap) or Scheduled (at clock times or every
// so often). Every edit is applied right away: the sound is rebuilt with it.
type Props = {
  preset: SavedPreset;
  /** The sound shown; null hides the sheet. */
  index: number | null;
  /** The edited mix: save it and rebuild that sound. */
  onChange: (next: SavedPreset, index: number) => void;
  onClose: () => void;
};

const MODES: { value: PlayMode; label: string }[] = [
  { value: 'loop', label: 'Loop' },
  { value: 'scatter', label: 'Random' },
  { value: 'scheduled', label: 'Scheduled' },
];

const MAX_GAP = 3600;
// Gaps run from seconds to an hour, so the slider is logarithmic.
const gapToPosition = (s: number) => Math.log(Math.max(1, Math.min(MAX_GAP, s))) / Math.log(MAX_GAP);
const positionToGap = (p: number) => Math.round(Math.exp(p * Math.log(MAX_GAP)));

export function ShotSheet({ preset, index, onChange, onClose }: Props) {
  const [drag, setDrag] = useState<{ key: string; value: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const sound = index === null ? null : preset.sounds[index];
  if (index === null || !sound) return null;

  const gap = scatterGap(preset, index);
  const schedule = scheduleOf(preset, index);
  const shown = (key: string, value: number) => (drag?.key === key ? drag.value : value);
  const apply = (next: SavedPreset) => {
    setDrag(null);
    onChange(next, index);
  };

  return (
    <BottomSheet title={sound.name} visible onClose={onClose}>
      <ScrollView contentContainerStyle={styles.body}>
        <Choice options={MODES} value={sound.playMode} onChange={(m) => m !== sound.playMode && apply(setPlayMode(preset, index, m))} big />

        {sound.playMode === 'loop' && <Text style={shared.help}>Plays all the time, looping without a gap.</Text>}

        {sound.playMode === 'scatter' && (
          <>
            <Text style={shared.help}>Plays once, waits a random time, plays again. Good for birds, thunder, a creaking floor.</Text>
            <Choice
              options={[
                { value: 'range', label: 'Pick the range' },
                { value: 'random', label: 'Fully random' },
              ]}
              value={gap.fullyRandom ? 'random' : 'range'}
              onChange={(v) => apply(setScatterGap(preset, index, { fullyRandom: v === 'random' }))}
            />
            {gap.fullyRandom ? (
              <Text style={shared.help}>Any wait from nothing up to 2 minutes.</Text>
            ) : (
              <>
                <SliderRow
                  label="Shortest wait"
                  value={gapToPosition(shown('min', gap.min))}
                  text={durationText(shown('min', gap.min))}
                  onChange={(p) => setDrag({ key: 'min', value: positionToGap(p) })}
                  onDone={(p) => apply(setScatterGap(preset, index, { min: positionToGap(p) }))}
                />
                <SliderRow
                  label="Longest wait"
                  value={gapToPosition(shown('max', gap.max))}
                  text={durationText(shown('max', gap.max))}
                  onChange={(p) => setDrag({ key: 'max', value: positionToGap(p) })}
                  onDone={(p) => apply(setScatterGap(preset, index, { max: positionToGap(p) }))}
                />
              </>
            )}
          </>
        )}

        {sound.playMode === 'scheduled' && (
          <>
            <Text style={shared.help}>Plays once at a set time, by the phone's clock. Good for a church bell or an hourly chime.</Text>
            <Choice
              options={[
                { value: 'times', label: 'At times' },
                { value: 'interval', label: 'Every…' },
              ]}
              value={schedule.type}
              onChange={(type) => apply(setSchedule(preset, index, { type }))}
            />
            {schedule.type === 'interval' ? (
              <SliderRow
                label="Every"
                value={shown('every', schedule.intervalMinutes)}
                min={1}
                max={720}
                step={1}
                text={durationText(shown('every', schedule.intervalMinutes) * 60)}
                onChange={(v) => setDrag({ key: 'every', value: v })}
                onDone={(v) => apply(setSchedule(preset, index, { intervalMinutes: v }))}
              />
            ) : (
              <>
                {schedule.times.length === 0 && <Text style={shared.help}>No times yet: it stays silent until you add one.</Text>}
                {schedule.times.map((t) => (
                  <View key={t} style={styles.timeRow}>
                    <Text style={styles.time}>{t}</Text>
                    <Pressable onPress={() => apply(removeScheduleTime(preset, index, t))} hitSlop={8} accessibilityLabel={`Remove ${t}`}>
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable style={shared.secondary} onPress={() => setAdding(true)} accessibilityRole="button">
                  <Text style={shared.secondaryText}>+ Add a time</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
      <TextPrompt
        title={adding ? 'Add a time (24 h, like 18:30)' : null}
        initial=""
        placeholder="HH:MM"
        okLabel="Add"
        onOk={(text) => {
          setAdding(false);
          const next = addScheduleTime(preset, index, text);
          if (next) apply(next);
          else Alert.alert('Not a time', 'Use 24-hour time, like 07:30 or 18:00.');
        }}
        onCancel={() => setAdding(false)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 8 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  time: { color: colors.text, fontSize: 18, fontWeight: '600' },
  remove: { color: colors.accent, fontSize: 15 },
});

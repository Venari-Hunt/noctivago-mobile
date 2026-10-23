import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../ui/BottomSheet';
import { Choice } from '../../ui/Choice';
import { SliderRow } from '../../ui/SliderRow';
import { TextPrompt } from '../../ui/TextPrompt';
import { FILTER_ROWS, gainText, isHz } from '../domain/filterRows';
import { FILTER_RANGES, hzToPosition, positionToHz, type FilterField } from '../domain/groupEdit';
import type { PlayMode } from '../domain/presetFile';
import { activeSoundFilters, setSoundFilter, soundFilterValue } from '../domain/soundFilterEdit';
import { clipTime, MIN_TRIM_SECONDS, setTrim, trimOf } from '../domain/trimEdit';
import {
  addScheduleTime,
  axisValueText,
  durationText,
  fadeMs,
  MAX_FADE_MS,
  PLAY_AXES,
  perPlay,
  perPlayText,
  removeScheduleTime,
  scatterGap,
  scheduleOf,
  setPlayMode,
  setFadeMs,
  setPerPlay,
  setScatterGap,
  setSchedule,
  type PlayAxis,
  type ShotMode,
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

const AXIS_ROWS: { axis: PlayAxis; label: string }[] = [
  { axis: 'volume', label: 'Volume' },
  { axis: 'pitch', label: 'Pitch' },
  { axis: 'pan', label: 'Pan' },
  { axis: 'speed', label: 'Speed' },
];

const MAX_GAP = 3600;
// Gaps run from seconds to an hour, so the slider is logarithmic.
const gapToPosition = (s: number) => Math.log(Math.max(1, Math.min(MAX_GAP, s))) / Math.log(MAX_GAP);
const positionToGap = (p: number) => Math.round(Math.exp(p * Math.log(MAX_GAP)));

export function ShotSheet({ preset, index, onChange, onClose }: Props) {
  const [drag, setDrag] = useState<{ key: string; value: number } | null>(null);
  const [adding, setAdding] = useState(false);
  /** The "Each play" row that is open; one at a time keeps the sheet short. */
  const [openAxis, setOpenAxis] = useState<PlayAxis | 'fade' | 'filters' | null>(null);
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
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
        {sound.playMode !== 'loop' && (
          <>
            <Text style={styles.section}>Each play</Text>
            {AXIS_ROWS.map(({ axis, label }) => {
              const mode = sound.playMode as ShotMode;
              const v = perPlay(preset, index, mode, axis);
              const a = PLAY_AXES[axis];
              const open = openAxis === axis;
              const lo = shown(`${axis}-min`, v.min);
              const hi = shown(`${axis}-max`, v.max);
              return (
                <View key={axis} style={styles.fold}>
                  <Pressable style={styles.foldHead} onPress={() => setOpenAxis(open ? null : axis)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                    <Text style={styles.foldTitle}>{label}</Text>
                    <Text style={styles.foldNote}>{perPlayText(axis, v)}</Text>
                  </Pressable>
                  {open && (
                    <>
                      <Choice
                        options={[
                          { value: 'range', label: 'Pick the range' },
                          { value: 'random', label: 'Fully random' },
                        ]}
                        value={v.fullyRandom ? 'random' : 'range'}
                        onChange={(c) => apply(setPerPlay(preset, index, mode, axis, { fullyRandom: c === 'random' }))}
                      />
                      {!v.fullyRandom && (
                        <>
                          <SliderRow
                            label="Lowest"
                            value={lo}
                            min={a.min}
                            max={a.max}
                            step={a.step}
                            text={axisValueText(axis, lo)}
                            onChange={(x) => setDrag({ key: `${axis}-min`, value: x })}
                            onDone={(x) => apply(setPerPlay(preset, index, mode, axis, { min: x }))}
                          />
                          <SliderRow
                            label="Highest"
                            value={hi}
                            min={a.min}
                            max={a.max}
                            step={a.step}
                            text={axisValueText(axis, hi)}
                            onChange={(x) => setDrag({ key: `${axis}-max`, value: x })}
                            onDone={(x) => apply(setPerPlay(preset, index, mode, axis, { max: x }))}
                          />
                        </>
                      )}
                    </>
                  )}
                </View>
              );
            })}
            {(() => {
              const mode = sound.playMode as ShotMode;
              const f = fadeMs(preset, index, mode);
              const open = openAxis === 'fade';
              const fin = shown('fade-in', f.inMs);
              const fout = shown('fade-out', f.outMs);
              return (
                <View style={styles.fold}>
                  <Pressable style={styles.foldHead} onPress={() => setOpenAxis(open ? null : 'fade')} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                    <Text style={styles.foldTitle}>Fade</Text>
                    <Text style={styles.foldNote}>{f.inMs || f.outMs ? `in ${f.inMs} ms, out ${f.outMs} ms` : 'None'}</Text>
                  </Pressable>
                  {open && (
                    <>
                      <SliderRow label="Fade in" value={fin} min={0} max={MAX_FADE_MS} step={50} text={`${Math.round(fin)} ms`} onChange={(x) => setDrag({ key: 'fade-in', value: x })} onDone={(x) => apply(setFadeMs(preset, index, mode, { inMs: x }))} />
                      <SliderRow label="Fade out" value={fout} min={0} max={MAX_FADE_MS} step={50} text={`${Math.round(fout)} ms`} onChange={(x) => setDrag({ key: 'fade-out', value: x })} onDone={(x) => apply(setFadeMs(preset, index, mode, { outMs: x }))} />
                    </>
                  )}
                </View>
              );
            })()}
          </>
        )}
        <Text style={styles.section}>Filters</Text>
        <View style={styles.fold}>
          <Pressable style={styles.foldHead} onPress={() => setOpenAxis(openAxis === 'filters' ? null : 'filters')} accessibilityRole="button" accessibilityState={{ expanded: openAxis === 'filters' }}>
            <Text style={styles.foldTitle}>High-pass, low-pass, gain, echo</Text>
            <Text style={styles.foldNote}>{activeSoundFilters(preset, index) ? `${activeSoundFilters(preset, index)} on` : 'All off'}</Text>
          </Pressable>
          {openAxis === 'filters' && (
            <>
              <Text style={shared.small}>Applied live to this sound only. A sound the PC baked already has its filters in the audio.</Text>
              {[...FILTER_ROWS.slice(0, 2), { field: 'gainDb' as FilterField, label: 'Gain', text: gainText, step: 0.5 }, ...FILTER_ROWS.slice(2)].map(({ field, label, text, step }) => {
                const value = soundFilterValue(preset, index, field);
                const r = FILTER_RANGES[field];
                const toValue = (pos: number) => (isHz(field) ? positionToHz(field, pos) : pos);
                return (
                  <SliderRow
                    key={field}
                    label={label}
                    text={text(shown(`filter-${field}`, value))}
                    value={isHz(field) ? hzToPosition(field, shown(`filter-${field}`, value)) : shown(`filter-${field}`, value)}
                    min={isHz(field) ? 0 : r.min}
                    max={isHz(field) ? 1 : r.max}
                    step={isHz(field) ? 0 : step}
                    onChange={(v) => setDrag({ key: `filter-${field}`, value: toValue(v) })}
                    onDone={(v) => apply(setSoundFilter(preset, index, field, toValue(v)))}
                  />
                );
              })}
            </>
          )}
        </View>
        {sound.durationSeconds ? (
          <>
            <Text style={styles.section}>Trim</Text>
            {(() => {
              const duration = sound.durationSeconds as number;
              const t = trimOf(preset.manifest, index, duration);
              const start = shown('trim-start', t.start);
              const end = shown('trim-end', t.end);
              return (
                <View style={styles.fold}>
                  <SliderRow label="Start" value={start} min={0} max={Math.max(MIN_TRIM_SECONDS, duration - MIN_TRIM_SECONDS)} step={0.1} text={clipTime(start)} onChange={(x) => setDrag({ key: 'trim-start', value: x })} onDone={(x) => apply(setTrim(preset, index, duration, { start: x }))} />
                  <SliderRow label="End" value={end} min={MIN_TRIM_SECONDS} max={duration} step={0.1} text={clipTime(end)} onChange={(x) => setDrag({ key: 'trim-end', value: x })} onDone={(x) => apply(setTrim(preset, index, duration, { end: x }))} />
                  <Text style={shared.small}>Keeps {clipTime(end - start)} of {clipTime(duration)}. The sound restarts when you change this.</Text>
                </View>
              );
            })()}
          </>
        ) : null}
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
  scroll: { maxHeight: 520 },
  section: { color: colors.faint, fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 4 },
  fold: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 12 },
  foldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  foldTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  foldNote: { color: colors.faint, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  body: { gap: 16, paddingBottom: 8 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  time: { color: colors.text, fontSize: 18, fontWeight: '600' },
  remove: { color: colors.accent, fontSize: 15 },
});

import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Choice } from '../../ui/Choice';
import { SliderRow } from '../../ui/SliderRow';
import { TextPrompt } from '../../ui/TextPrompt';
import {
  deleteGroup,
  DRIFT_RANGES,
  driftAxis,
  FILTER_RANGES,
  filterValue,
  groupOfSound,
  groupsOf,
  hzToPosition,
  positionToHz,
  renameGroup,
  setDrift,
  setFilter,
  setMember,
  type DriftAxisName,
  type FilterField,
} from '../domain/groupEdit';
import type { SavedPreset } from '../storage';
import { colors, shared } from './theme';

// One Sound Group: its sounds, and the filters and drift they share (the
// desktop's Remix → Group mode, minus EQ, which stays as the PC set it).
type Props = {
  preset: SavedPreset;
  /** The group shown; null hides the sheet. */
  index: number | null;
  /** Every edit, already applied: save it and play it. */
  onChange: (next: SavedPreset) => void;
  onClose: () => void;
};

const hz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)} kHz` : `${v} Hz`);
const FILTER_ROWS: { field: FilterField; label: string; text: (v: number) => string; step?: number }[] = [
  { field: 'highpassHz', label: 'High-pass (cuts lows)', text: (v) => (v > 0 ? hz(v) : 'Off') },
  { field: 'lowpassHz', label: 'Low-pass (cuts highs)', text: (v) => (v < 20000 ? hz(v) : 'Off') },
  { field: 'gainDb', label: 'Gain', text: (v) => `${v > 0 ? '+' : ''}${v} dB`, step: 0.5 },
  { field: 'echoDelayMs', label: 'Echo delay', text: (v) => (v > 0 ? `${v} ms` : 'Off'), step: 10 },
  { field: 'echoDecay', label: 'Echo decay', text: (v) => (v > 0 ? v.toFixed(2) : 'Off'), step: 0.01 },
];
const isHz = (f: FilterField): f is 'highpassHz' | 'lowpassHz' => f === 'highpassHz' || f === 'lowpassHz';

const pan = (v: number) => (Math.abs(v) < 0.005 ? 'Center' : `${v < 0 ? 'L' : 'R'} ${Math.round(Math.abs(v) * 100)}%`);
const DRIFT_ROWS: { axis: DriftAxisName; label: string; text: (v: number) => string; step: number }[] = [
  { axis: 'volume', label: 'Volume drift', text: (v) => `${Math.round(v * 100)}%`, step: 0.01 },
  { axis: 'pan', label: 'Pan drift', text: pan, step: 0.05 },
  { axis: 'pitch', label: 'Pitch drift', text: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} st`, step: 0.1 },
];

type DriftMode = 'off' | 'together' | 'each';

export function GroupSheet({ preset, index, onChange, onClose }: Props) {
  const [renaming, setRenaming] = useState(false);
  /** The slider being dragged and its value, shown before it's saved. */
  const [drag, setDrag] = useState<{ key: string; value: number } | null>(null);
  const groups = groupsOf(preset);
  const group = index === null ? null : groups[index];
  if (index === null || !group) return null;

  const shown = (key: string, value: number) => (drag?.key === key ? drag.value : value);
  const done = (next: SavedPreset) => {
    setDrag(null);
    onChange(next);
  };

  const confirmDelete = () =>
    Alert.alert(`Delete the group "${group.name}"?`, 'Its sounds stay in the mix and play on their own.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onClose();
          onChange(deleteGroup(preset, index));
        },
      },
    ]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={shared.page}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.link}>‹ Done</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable onPress={() => setRenaming(true)} hitSlop={12}>
              <Text style={styles.link}>Rename</Text>
            </Pressable>
            <Pressable onPress={confirmDelete} hitSlop={12}>
              <Text style={styles.danger}>Delete</Text>
            </Pressable>
          </View>
        </View>
        <Text style={shared.title} numberOfLines={2}>{group.name}</Text>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={shared.help}>Sounds in a group share these filters and drift. Tap a sound to add or take it out.</Text>
          <View style={styles.members}>
            {preset.sounds.map((s, i) => {
              const at = groupOfSound(preset, i);
              const member = at === index;
              const elsewhere = at >= 0 && !member ? groups[at].name : null;
              return (
                <Pressable
                  key={`${s.file ?? i}`}
                  style={[styles.member, member && styles.memberOn]}
                  onPress={() => onChange(setMember(preset, index, i, !member))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: member }}
                >
                  <Text style={[styles.memberText, member && styles.memberTextOn]} numberOfLines={1}>
                    {member ? '✓ ' : ''}
                    {s.name}
                  </Text>
                  {elsewhere && <Text style={styles.elsewhere} numberOfLines={1}>in {elsewhere}</Text>}
                </Pressable>
              );
            })}
            {preset.sounds.length === 0 && <Text style={shared.help}>This mix has no sounds yet.</Text>}
          </View>

          <Text style={styles.section}>Filters</Text>
          {FILTER_ROWS.map(({ field, label, text, step }) => {
            const value = filterValue(group, field);
            const r = FILTER_RANGES[field];
            const toValue = (pos: number) => (isHz(field) ? positionToHz(field, pos) : pos);
            const live = shown(field, value);
            return (
              <SliderRow
                key={field}
                label={label}
                text={text(live)}
                value={isHz(field) ? hzToPosition(field, value) : value}
                min={isHz(field) ? 0 : r.min}
                max={isHz(field) ? 1 : r.max}
                step={isHz(field) ? 0 : step}
                onChange={(v) => setDrag({ key: field, value: toValue(v) })}
                onDone={(v) => done(setFilter(preset, index, field, toValue(v)))}
              />
            );
          })}

          <Text style={styles.section}>Drift</Text>
          <Text style={shared.help}>Together: the whole group moves as one. Each sound: every sound wanders on its own, in this range.</Text>
          {DRIFT_ROWS.map(({ axis, label, text, step }) => {
            const a = driftAxis(group, axis);
            const mode: DriftMode = !a.enabled ? 'off' : a.perSound ? 'each' : 'together';
            const range = DRIFT_RANGES[axis];
            const options: { value: DriftMode; label: string }[] =
              axis === 'pitch'
                ? [{ value: 'off', label: 'Off' }, { value: 'each', label: 'Each sound' }]
                : [{ value: 'off', label: 'Off' }, { value: 'together', label: 'Together' }, { value: 'each', label: 'Each sound' }];
            const pick = (m: DriftMode) =>
              onChange(setDrift(preset, index, axis, m === 'off' ? { enabled: false } : { enabled: true, perSound: m === 'each' }));
            return (
              <View key={axis} style={styles.drift}>
                <Text style={styles.label}>{label}</Text>
                <Choice options={options} value={mode} onChange={pick} />
                {mode !== 'off' &&
                  (['min', 'max'] as const).map((end) => {
                    const key = `${axis}.${end}`;
                    const value = a[end] as number;
                    return (
                      <SliderRow
                        key={end}
                        label={end === 'min' ? 'Lowest' : 'Highest'}
                        text={text(shown(key, value))}
                        value={value}
                        min={range.min}
                        max={range.max}
                        step={step}
                        onChange={(v) => setDrag({ key, value: v })}
                        onDone={(v) => done(setDrift(preset, index, axis, { [end]: v }))}
                      />
                    );
                  })}
              </View>
            );
          })}
        </ScrollView>
      </View>
      <TextPrompt
        title={renaming ? 'Rename group' : null}
        initial={group.name}
        onOk={(name) => {
          setRenaming(false);
          onChange(renameGroup(preset, index, name));
        }}
        onCancel={() => setRenaming(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 20 },
  link: { color: colors.accent, fontSize: 16 },
  danger: { color: colors.danger, fontSize: 16 },
  body: { gap: 14, paddingBottom: 32 },
  members: { gap: 8 },
  member: { backgroundColor: colors.card, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  memberOn: { backgroundColor: colors.raised, borderColor: colors.accent, borderWidth: 1 },
  memberText: { color: colors.dim, fontSize: 16, flexShrink: 1 },
  memberTextOn: { color: colors.text },
  elsewhere: { color: colors.faint, fontSize: 14 },
  section: { color: colors.accent, fontSize: 18, fontWeight: '700', marginTop: 8 },
  drift: { gap: 8 },
  label: { color: colors.text, fontSize: 16 },
});

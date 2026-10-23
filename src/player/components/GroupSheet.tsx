import { useEffect, useState } from 'react';
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
  type Group,
} from '../domain/groupEdit';
import type { SavedPreset } from '../storage';
import { colors, shared } from './theme';

// One Sound Group: its volume, its sounds, and the filters and drift they
// share (the desktop's Remix → Group mode, minus EQ, which stays as the PC
// set it). Volume and sounds are always in view; filters and drift fold away.
type Props = {
  preset: SavedPreset;
  /** The group shown; null hides the sheet. */
  index: number | null;
  /** Open with the "+ Add sounds" list showing (a group just made). */
  startWithSounds?: boolean;
  /** Every edit, already applied: save it and play it. */
  onChange: (next: SavedPreset) => void;
  onClose: () => void;
};

const hz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)} kHz` : `${v} Hz`);
const FILTER_ROWS: { field: FilterField; label: string; text: (v: number) => string; step?: number }[] = [
  { field: 'highpassHz', label: 'High-pass (cuts lows)', text: (v) => (v > 0 ? hz(v) : 'Off') },
  { field: 'lowpassHz', label: 'Low-pass (cuts highs)', text: (v) => (v < 20000 ? hz(v) : 'Off') },
  { field: 'echoDelayMs', label: 'Echo delay', text: (v) => (v > 0 ? `${v} ms` : 'Off'), step: 10 },
  { field: 'echoDecay', label: 'Echo decay', text: (v) => (v > 0 ? v.toFixed(2) : 'Off'), step: 0.01 },
];
const isHz = (f: FilterField): f is 'highpassHz' | 'lowpassHz' => f === 'highpassHz' || f === 'lowpassHz';
const gainText = (v: number) => (v === 0 ? '0 dB (as is)' : `${v > 0 ? '+' : ''}${v} dB`);

const pan = (v: number) => (Math.abs(v) < 0.005 ? 'Center' : `${v < 0 ? 'L' : 'R'} ${Math.round(Math.abs(v) * 100)}%`);
const DRIFT_ROWS: { axis: DriftAxisName; label: string; text: (v: number) => string; step: number }[] = [
  { axis: 'volume', label: 'Volume drift', text: (v) => `${Math.round(v * 100)}%`, step: 0.01 },
  { axis: 'pan', label: 'Pan drift', text: pan, step: 0.05 },
  { axis: 'pitch', label: 'Pitch drift', text: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} st`, step: 0.1 },
];

type DriftMode = 'off' | 'together' | 'each';
type Fold = 'add' | 'filters' | 'drift';

function driftMode(group: Group, axis: DriftAxisName): DriftMode {
  const a = driftAxis(group, axis);
  return !a.enabled ? 'off' : a.perSound ? 'each' : 'together';
}

export function GroupSheet({ preset, index, startWithSounds, onChange, onClose }: Props) {
  const [renaming, setRenaming] = useState(false);
  /** The folded card that is open; one at a time keeps the screen short. */
  const [open, setOpen] = useState<Fold | null>(null);
  useEffect(() => {
    if (index !== null && startWithSounds) setOpen('add');
  }, [index, startWithSounds]);
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
  const toggle = (k: Fold) => setOpen(open === k ? null : k);

  const members = group.soundIndexes.filter((i) => preset.sounds[i]);
  const others = preset.sounds.map((_, i) => ({ i, at: groupOfSound(preset, i) })).filter(({ at }) => at !== index);
  const activeFilters =
    FILTER_ROWS.filter(({ field }) => filterValue(group, field) !== FILTER_RANGES[field].off).length;
  const filtersNote = activeFilters ? `${activeFilters} on` : 'All off';
  const driftOn = DRIFT_ROWS.filter(({ axis }) => driftMode(group, axis) !== 'off').map(({ axis }) => axis);
  const driftNote = driftOn.length ? driftOn.join(', ') : 'All off';

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
          <View style={styles.card}>
            <SliderRow
              label="Group volume"
              text={gainText(shown('gainDb', filterValue(group, 'gainDb')))}
              value={filterValue(group, 'gainDb')}
              min={FILTER_RANGES.gainDb.min}
              max={FILTER_RANGES.gainDb.max}
              step={0.5}
              onChange={(v) => setDrag({ key: 'gainDb', value: v })}
              onDone={(v) => done(setFilter(preset, index, 'gainDb', v))}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sounds in this group · {members.length}</Text>
            {members.length === 0 && <Text style={shared.help}>No sounds yet. Add some below.</Text>}
            {members.map((i) => (
              <View key={`${preset.sounds[i].file ?? i}`} style={styles.member}>
                <Text style={styles.memberText} numberOfLines={1}>{preset.sounds[i].name}</Text>
                <Pressable
                  onPress={() => onChange(setMember(preset, index, i, false))}
                  hitSlop={10}
                  accessibilityLabel={`Take ${preset.sounds[i].name} out`}
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={shared.secondary} onPress={() => toggle('add')} accessibilityRole="button">
              <Text style={shared.secondaryText}>{open === 'add' ? 'Close list' : '+ Add sounds'}</Text>
            </Pressable>
            {open === 'add' &&
              others.map(({ i, at }) => (
                <Pressable
                  key={`${preset.sounds[i].file ?? i}`}
                  style={styles.pick}
                  onPress={() => onChange(setMember(preset, index, i, true))}
                  accessibilityRole="button"
                >
                  <Text style={styles.pickText} numberOfLines={1}>+ {preset.sounds[i].name}</Text>
                  {at >= 0 && <Text style={styles.elsewhere} numberOfLines={1}>moves from {groups[at].name}</Text>}
                </Pressable>
              ))}
            {open === 'add' && others.length === 0 && <Text style={shared.help}>Every sound in the mix is already here.</Text>}
          </View>

          <Pressable style={styles.fold} onPress={() => toggle('filters')} accessibilityRole="button" accessibilityState={{ expanded: open === 'filters' }}>
            <View style={styles.foldText}>
              <Text style={styles.cardTitle}>Filters</Text>
              <Text style={styles.foldNote}>{filtersNote}</Text>
            </View>
            <Text style={styles.chevron}>{open === 'filters' ? '▾' : '▸'}</Text>
          </Pressable>
          {open === 'filters' && (
            <View style={styles.card}>
              {FILTER_ROWS.map(({ field, label, text, step }) => {
                const value = filterValue(group, field);
                const r = FILTER_RANGES[field];
                const toValue = (pos: number) => (isHz(field) ? positionToHz(field, pos) : pos);
                return (
                  <SliderRow
                    key={field}
                    label={label}
                    text={text(shown(field, value))}
                    value={isHz(field) ? hzToPosition(field, value) : value}
                    min={isHz(field) ? 0 : r.min}
                    max={isHz(field) ? 1 : r.max}
                    step={isHz(field) ? 0 : step}
                    onChange={(v) => setDrag({ key: field, value: toValue(v) })}
                    onDone={(v) => done(setFilter(preset, index, field, toValue(v)))}
                  />
                );
              })}
            </View>
          )}

          <Pressable style={styles.fold} onPress={() => toggle('drift')} accessibilityRole="button" accessibilityState={{ expanded: open === 'drift' }}>
            <View style={styles.foldText}>
              <Text style={styles.cardTitle}>Drift</Text>
              <Text style={styles.foldNote}>{driftNote}</Text>
            </View>
            <Text style={styles.chevron}>{open === 'drift' ? '▾' : '▸'}</Text>
          </Pressable>
          {open === 'drift' && (
            <View style={styles.card}>
              <Text style={shared.help}>Together: the whole group moves as one. Each sound: every sound wanders on its own, in this range.</Text>
              {DRIFT_ROWS.map(({ axis, label, text, step }) => {
                const a = driftAxis(group, axis);
                const mode = driftMode(group, axis);
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
            </View>
          )}
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
  body: { gap: 12, paddingBottom: 32 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderColor: colors.raised, borderWidth: 1, padding: 14, gap: 12 },
  cardTitle: { color: colors.accent, fontSize: 17, fontWeight: '700' },
  member: { backgroundColor: colors.raised, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  memberText: { color: colors.text, fontSize: 16, flexShrink: 1 },
  remove: { color: colors.danger, fontSize: 14 },
  pick: { paddingVertical: 10, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomColor: colors.raised, borderBottomWidth: 1 },
  pickText: { color: colors.dim, fontSize: 16, flexShrink: 1 },
  elsewhere: { color: colors.faint, fontSize: 13 },
  fold: { backgroundColor: colors.card, borderRadius: 14, borderColor: colors.raised, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  foldText: { gap: 2 },
  foldNote: { color: colors.faint, fontSize: 14 },
  chevron: { color: colors.accent, fontSize: 20 },
  drift: { gap: 8 },
  label: { color: colors.text, fontSize: 16 },
});

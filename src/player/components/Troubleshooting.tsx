import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { setSettings, useSettings } from '../../settings/store';
import { colors } from './theme';

// Tools for finding out why a mix sounds wrong, folded away above the sound
// list. Each switch is a setting, so it stays on between mixes.
export function Troubleshooting() {
  const { soundMeters, showPlaybackCheck } = useSettings();
  const [open, setOpen] = useState(soundMeters || showPlaybackCheck);
  return (
    <View style={styles.box}>
      <Pressable style={styles.head} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.title}>Troubleshooting</Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <>
          <Row
            label="Level meter on every sound"
            hint="A bar under each name shows how loud it is. Red means its peak is near the limiter."
            value={soundMeters}
            onChange={(v) => setSettings({ soundMeters: v })}
          />
          <Row
            label="Playback check"
            hint="Shows how long the audio kept running and the battery drain per hour."
            value={showPlaybackCheck}
            onChange={(v) => setSettings({ showPlaybackCheck: v })}
          />
        </>
      )}
    </View>
  );
}

function Row({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  title: { color: colors.dim, fontSize: 15, fontWeight: '600' },
  chevron: { color: colors.dim, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 15 },
  hint: { color: colors.faint, fontSize: 13 },
});

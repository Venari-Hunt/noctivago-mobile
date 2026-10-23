import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { PlayButton } from './PlayButton';
import { VolumeRow } from './VolumeRow';
import { colors } from './theme';
import { gainToPosition, positionToGain } from '../../shared/volumeScale.js';

// One sound in a mix, laid out like the desktop's sound card: the name on its
// own line across the whole card (with ⋮ and, for shots, a play button at the
// right), a line of info (group, mode or volume), then the on/off button and
// the slider. Hold the name, or tap ⋮, for more (group, remove). Random
// Interval and Scheduled sounds get a small play button that plays one shot
// now (the desktop's test fire).
// The slider is the desktop's: center is 100%, left tapers in dB to silence,
// right goes up to 200%. Values in and out are gains.
type Props = {
  label: string;
  value: number;
  note: string;
  off?: boolean;
  onToggle: () => void;
  onChange: (value: number) => void;
  onDone: (value: number) => void;
  onLongPress: () => void;
  onTest?: () => void;
  /** A level bar, under the info line. */
  meter?: ReactNode;
};

export function SoundCard({ label, value, note, off, onToggle, onChange, onDone, onTest, onLongPress, meter }: Props) {
  return (
    <View style={[styles.card, off && styles.cardOff]}>
      <View style={styles.nameRow}>
        <Pressable style={styles.nameBox} onLongPress={onLongPress} accessibilityHint="Hold for options">
          <Text style={[styles.name, off && styles.nameOff]}>{label}</Text>
        </Pressable>
        {onTest && <PlayButton small playing={false} label={`Play one shot of ${label} now`} onPress={onTest} />}
        <Pressable style={styles.more} onPress={onLongPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Options for ${label}`}>
          <Text style={styles.moreText}>⋮</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>{note}</Text>
      {meter}
      <View style={styles.controls}>
        <Pressable
          style={[styles.toggle, !off && styles.toggleOn]}
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityState={{ checked: !off }}
        >
          <View style={[styles.dot, !off && styles.dotOn]} />
        </Pressable>
        <View style={styles.slider}>
          <VolumeRow
            headless
            label={label}
            off={off}
            value={gainToPosition(value)}
            onChange={(p) => onChange(positionToGain(p))}
            onDone={(p) => onDone(positionToGain(p))}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, backgroundColor: colors.card, borderRadius: 14, paddingVertical: 10, paddingLeft: 12, paddingRight: 12 },
  cardOff: { opacity: 0.7 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameBox: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  nameOff: { color: colors.faint },
  note: { color: colors.faint, fontSize: 13 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slider: { flex: 1 },
  toggle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.dim, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.dim },
  dotOn: { backgroundColor: '#000' },
  more: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.dim, fontSize: 24, fontWeight: '700' },
});

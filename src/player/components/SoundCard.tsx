import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlayButton } from './PlayButton';
import { VolumeRow } from './VolumeRow';
import { colors } from './theme';
import { gainToPosition, positionToGain } from '../../shared/volumeScale.js';

// One sound in a mix: an on/off button, then its name and volume. Hold the
// name, or tap the ⋮ at the right, for more (group, remove). Random Interval and Scheduled sounds also
// get a small play button that plays one shot now (the desktop's test fire).
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
};

export function SoundCard({ label, value, off, onToggle, onChange, onDone, onTest, onLongPress, ...rest }: Props) {
  return (
    <View style={[styles.card, off && styles.cardOff]}>
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
      <View style={styles.body}>
        <VolumeRow
          label={label}
          off={off}
          value={gainToPosition(value)}
          onChange={(p) => onChange(positionToGain(p))}
          onDone={(p) => onDone(positionToGain(p))}
          onLongPress={onLongPress}
          {...rest}
        />
      </View>
      {onTest && <PlayButton small playing={false} label={`Play one shot of ${label} now`} onPress={onTest} />}
      <Pressable style={styles.more} onPress={onLongPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Options for ${label}`}>
        <Text style={styles.moreText}>⋮</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, paddingVertical: 10, paddingLeft: 12, paddingRight: 12 },
  cardOff: { opacity: 0.7 },
  toggle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.faint },
  dotOn: { backgroundColor: '#000' },
  body: { flex: 1 },
  more: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.dim, fontSize: 24, fontWeight: '700' },
});

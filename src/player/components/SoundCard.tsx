import { Pressable, StyleSheet, View } from 'react-native';
import { PlayButton } from './PlayButton';
import { VolumeRow } from './VolumeRow';
import { colors } from './theme';

// One sound in a mix: an on/off button, then its name and volume. Hold the
// name for more (group, remove). Random Interval and Scheduled sounds also
// get a small play button that plays one shot now (the desktop's test fire).
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

export function SoundCard({ label, off, onToggle, onTest, ...rest }: Props) {
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
        <VolumeRow label={label} off={off} {...rest} />
      </View>
      {onTest && <PlayButton small playing={false} label={`Play one shot of ${label} now`} onPress={onTest} />}
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
});

import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

type Props = {
  label: string;
  value: number;
  note?: string;
  disabled?: boolean;
  /** Turned off in the mix: dimmed, slider still works. */
  off?: boolean;
  onChange: (value: number) => void;
  /** Called once the finger lifts, to save the value. */
  onDone: (value: number) => void;
  /** Hold the name for options (sounds in a mix). */
  onLongPress?: () => void;
};

export function VolumeRow({ label, value, note, disabled, off, onChange, onDone, onLongPress }: Props) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.head} onLongPress={onLongPress} disabled={!onLongPress} accessibilityHint={onLongPress ? 'Hold for options' : undefined}>
        <Text style={[styles.label, (disabled || off) && styles.off]} numberOfLines={1}>{label}</Text>
        <Text style={styles.value}>{note ?? `${Math.round(value * 100)}%`}</Text>
      </Pressable>
      <Slider
        value={value}
        disabled={disabled}
        minimumValue={0}
        maximumValue={1}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.raised}
        thumbTintColor={disabled ? colors.faint : colors.accent}
        onValueChange={onChange}
        onSlidingComplete={onDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.text, fontSize: 16, flexShrink: 1 },
  off: { color: colors.faint },
  value: { color: colors.faint, fontSize: 14 },
});

import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../player/components/theme';

// A labeled slider with its value on the right: volumes, filters, drift.
type Props = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** The value as shown on the right. */
  text: string;
  disabled?: boolean;
  /** Dimmed name, slider still works (a sound turned off). */
  dim?: boolean;
  onChange: (value: number) => void;
  /** Called once the finger lifts, to save the value. */
  onDone: (value: number) => void;
  /** Hold the name for options. */
  onLongPress?: () => void;
  /** Just the slider: the caller draws the name and value (a sound card). */
  headless?: boolean;
};

export function SliderRow({ label, value, min = 0, max = 1, step = 0, text, disabled, dim, onChange, onDone, onLongPress, headless }: Props) {
  return (
    <View style={styles.row}>
      {!headless && <Pressable style={styles.head} onLongPress={onLongPress} disabled={!onLongPress} accessibilityHint={onLongPress ? 'Hold for options' : undefined}>
        <Text style={[styles.label, (disabled || dim) && styles.off]}>{label}</Text>
        <Text style={styles.value}>{text}</Text>
      </Pressable>}
      <Slider
        value={value}
        disabled={disabled}
        minimumValue={min}
        maximumValue={max}
        step={step}
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
  // The name takes the room the value leaves and wraps by word; the value
  // never takes more than half the row, so a long name is never squeezed.
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  label: { color: colors.text, fontSize: 16, flex: 1 },
  off: { color: colors.faint },
  value: { color: colors.faint, fontSize: 14, maxWidth: '50%', textAlign: 'right' },
});

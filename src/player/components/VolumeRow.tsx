import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

type Props = {
  label: string;
  value: number;
  note?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Called once the finger lifts, to save the value. */
  onDone: (value: number) => void;
};

export function VolumeRow({ label, value, note, disabled, onChange, onDone }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={[styles.label, disabled && styles.off]} numberOfLines={1}>{label}</Text>
        <Text style={styles.value}>{note ?? `${Math.round(value * 100)}%`}</Text>
      </View>
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

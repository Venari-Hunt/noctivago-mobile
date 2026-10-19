import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from './theme';

// The round Play / Pause button, drawn with plain views (no icon font, so it
// ships over the air). `small`: the quiet one on a sound card that plays a
// single shot (test fire).
type Props = { playing: boolean; disabled?: boolean; small?: boolean; label?: string; onPress: () => void };

export function PlayButton({ playing, disabled, small, label, onPress }: Props) {
  const s = small ? 0.5 : 1;
  const ink = small ? colors.accent : '#000';
  return (
    <Pressable
      style={[styles.button, small && styles.small, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
      hitSlop={small ? 8 : 0}
      accessibilityRole="button"
      accessibilityLabel={label ?? (playing ? 'Pause' : 'Play')}
    >
      {playing ? (
        <View style={[styles.bars, { gap: 8 * s }]}>
          <View style={[styles.bar, { width: 8 * s, height: 26 * s, backgroundColor: ink }]} />
          <View style={[styles.bar, { width: 8 * s, height: 26 * s, backgroundColor: ink }]} />
        </View>
      ) : (
        // A CSS-border triangle, nudged right so it looks centered.
        <View
          style={[
            styles.triangle,
            { marginLeft: 6 * s, borderTopWidth: 15 * s, borderBottomWidth: 15 * s, borderLeftWidth: 24 * s, borderLeftColor: ink },
          ]}
        />
      )}
    </Pressable>
  );
}

const SIZE = 72;
const SMALL = 36;

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  small: { width: SMALL, height: SMALL, borderRadius: SMALL / 2, backgroundColor: colors.raised },
  disabled: { opacity: 0.4 },
  bars: { flexDirection: 'row' },
  bar: { borderRadius: 2 },
  triangle: { width: 0, height: 0, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
});

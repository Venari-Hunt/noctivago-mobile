import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from './theme';

// The round Play / Pause button, drawn with plain views (no icon font, so it
// ships over the air).
type Props = { playing: boolean; disabled?: boolean; onPress: () => void };

export function PlayButton({ playing, disabled, onPress }: Props) {
  return (
    <Pressable
      style={[styles.button, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause' : 'Play'}
    >
      {playing ? (
        <View style={styles.bars}>
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>
      ) : (
        <View style={styles.triangle} />
      )}
    </Pressable>
  );
}

const SIZE = 72;

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  bars: { flexDirection: 'row', gap: 8 },
  bar: { width: 8, height: 26, borderRadius: 2, backgroundColor: '#000' },
  // A CSS-border triangle, nudged right so it looks centered.
  triangle: {
    marginLeft: 6,
    width: 0,
    height: 0,
    borderTopWidth: 15,
    borderBottomWidth: 15,
    borderLeftWidth: 24,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#000',
  },
});

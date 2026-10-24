import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../player/components/theme';

// A row of pill buttons, one picked: tabs, sort order…
type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  big?: boolean;
};

export function Choice<T extends string>({ options, value, onChange, big }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.pill, big && styles.big, on && styles.on]}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, big && styles.bigText, on && styles.onText]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps: a row too long for the screen goes onto a second line, never off the edge.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: colors.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  big: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  on: { backgroundColor: colors.accent },
  text: { color: colors.dim, fontSize: 14 },
  bigText: { fontSize: 17, fontWeight: '600' },
  onText: { color: '#000' },
});

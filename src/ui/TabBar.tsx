import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../player/components/theme';

// Android-style tabs along the bottom of a screen, one picked.
type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function TabBar<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.bar}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={styles.tab}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <View style={[styles.mark, on && styles.markOn]} />
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.card, borderTopColor: colors.raised, borderTopWidth: 1, paddingBottom: 24 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 6, gap: 6 },
  mark: { width: 32, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  markOn: { backgroundColor: colors.accent },
  text: { color: colors.dim, fontSize: 15 },
  textOn: { color: colors.accent, fontWeight: '700' },
});

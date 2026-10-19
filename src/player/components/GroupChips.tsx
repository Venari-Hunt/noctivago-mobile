import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from './theme';

// The mix's Sound Groups as one row of chips: tap one to edit it, or start a
// new one.
type Props = {
  groups: { name: string; soundIndexes: number[] }[];
  onOpen: (index: number) => void;
  onNew: () => void;
};

export function GroupChips({ groups, onOpen, onNew }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {groups.map((g, gi) => (
        <Pressable key={`${gi}-${g.name}`} style={styles.chip} onPress={() => onOpen(gi)} accessibilityRole="button">
          <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
          <Text style={styles.count}>{g.soundIndexes.length}</Text>
        </Pressable>
      ))}
      <Pressable style={[styles.chip, styles.add]} onPress={onNew} accessibilityRole="button">
        <Text style={styles.addText}>{groups.length === 0 ? '+ Sound Group' : '+ Group'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.raised, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14, maxWidth: 220 },
  name: { color: colors.text, fontSize: 15, flexShrink: 1 },
  count: { color: colors.faint, fontSize: 13 },
  add: { backgroundColor: 'transparent', borderColor: colors.accent, borderWidth: 1 },
  addText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});

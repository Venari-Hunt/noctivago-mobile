import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../../player/components/theme';
import { formatLength, LONG_SOUND_SECONDS, type LibrarySound } from '../domain/library';

type Props = {
  sound: LibrarySound;
  previewing: boolean;
  /** Set when picking sounds for a mix: a check mark instead of play. */
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export function SoundRow({ sound, previewing, selected, onPress, onLongPress }: Props) {
  const length = formatLength(sound.durationSeconds);
  const long = (sound.durationSeconds ?? 0) > LONG_SOUND_SECONDS;
  const details = [length, sound.tags.join(', ')].filter(Boolean).join(' · ');
  const picking = selected !== undefined;
  const on = picking ? selected : previewing;
  const label = picking
    ? `${sound.name}, ${selected ? 'picked' : 'not picked'}`
    : `${sound.name}, ${previewing ? 'playing, tap to stop' : 'tap to listen'}, hold for options`;
  return (
    <Pressable style={[styles.item, on && styles.on]} onPress={onPress} onLongPress={onLongPress} accessibilityLabel={label}>
      <Text style={[styles.icon, on && styles.onIcon]}>{picking ? (selected ? '✓' : '○') : previewing ? '■' : '▶'}</Text>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>{sound.name}</Text>
        {details ? <Text style={shared.small} numberOfLines={1}>{details}</Text> : null}
        {long && <Text style={styles.long}>Long sound: uses a lot of memory while playing</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  on: { backgroundColor: colors.raised },
  icon: { color: colors.faint, fontSize: 18, width: 22, textAlign: 'center' },
  onIcon: { color: colors.accent },
  text: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  long: { color: colors.accent, fontSize: 12 },
});

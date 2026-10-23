import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNow } from '../../ui/useNow';
import { countdown, presetLabel, SLEEP_PRESET_MINUTES } from '../domain/sleepTimer';
import { colors } from './theme';

type Props = {
  /** Wall-clock ms when playback stops, or null when the timer is off. */
  endsAt: number | null;
  /** The chosen preset, highlighted while the timer runs. */
  minutes: number | null;
  disabled?: boolean;
  onPick: (minutes: number) => void;
  /** Ask for a clock time to stop at. */
  onAtTime: () => void;
  onOff: () => void;
};

// The timer's choices (in the player's Timer sheet): Off, then 15m to 2h, then a clock time.
export function SleepTimerRow({ endsAt, minutes, disabled, onPick, onAtTime, onOff }: Props) {
  const now = useNow(endsAt !== null);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {endsAt !== null ? `Stops in ${countdown(endsAt - now)}` : 'Stop playing after:'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip text="Off" active={endsAt === null} disabled={disabled} onPress={onOff} />
        {SLEEP_PRESET_MINUTES.map((m) => (
          <Chip key={m} text={presetLabel(m)} active={endsAt !== null && m === minutes} disabled={disabled} onPress={() => onPick(m)} />
        ))}
        <Chip text="At a time…" disabled={disabled} onPress={onAtTime} />
      </ScrollView>
    </View>
  );
}

function Chip({ text, active, disabled, onPress }: { text: string; active?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipOn, disabled && styles.off]} disabled={disabled} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: colors.text, fontSize: 16 },
  chips: { gap: 8 },
  chip: { backgroundColor: colors.raised, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  chipTextOn: { color: '#000' },
  off: { opacity: 0.5 },
});

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countdown, presetLabel, SLEEP_PRESET_MINUTES } from '../domain/sleepTimer';
import { colors } from './theme';

type Props = {
  /** Wall-clock ms when playback stops, or null when the timer is off. */
  endsAt: number | null;
  disabled?: boolean;
  onPick: (minutes: number) => void;
  onOff: () => void;
};

export function SleepTimerRow({ endsAt, disabled, onPick, onOff }: Props) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (endsAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Sleep timer{endsAt !== null ? ` · stops in ${countdown(endsAt - now)}` : ''}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip text="Off" active={endsAt === null} disabled={disabled} onPress={onOff} />
        {SLEEP_PRESET_MINUTES.map((m) => (
          <Chip key={m} text={presetLabel(m)} disabled={disabled} onPress={() => onPick(m)} />
        ))}
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

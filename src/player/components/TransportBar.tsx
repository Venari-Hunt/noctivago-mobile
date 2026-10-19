import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNow } from '../../ui/useNow';
import { timerButtonLabel } from '../domain/sleepTimer';
import { PlayButton } from './PlayButton';
import { VolumeRow } from './VolumeRow';
import { colors } from './theme';

// The player's bottom bar, always in reach: master volume, then the sleep
// timer, Play / Pause and Add sounds.
type Props = {
  playing: boolean;
  /** "Loading sounds… 2 of 5" and the like, shown above the buttons. */
  status: string | null;
  disabled: boolean;
  onPlayPause: () => void;
  master: number;
  onMaster: (value: number) => void;
  onMasterDone: (value: number) => void;
  /** Wall-clock ms when the timer stops playback, or null. */
  sleepEndsAt: number | null;
  onTimer: () => void;
  adding: boolean;
  onAdd: () => void;
};

export function TransportBar(p: Props) {
  const now = useNow(p.sleepEndsAt !== null);
  const timerOn = p.sleepEndsAt !== null;
  return (
    <View style={styles.bar}>
      <VolumeRow label="Master volume" value={p.master} onChange={p.onMaster} onDone={p.onMasterDone} />
      {p.status && <Text style={styles.status}>{p.status}</Text>}
      <View style={styles.buttons}>
        <Side
          label={timerButtonLabel(timerOn ? p.sleepEndsAt! - now : null)}
          hint="Sleep timer"
          on={timerOn}
          disabled={p.disabled}
          onPress={p.onTimer}
        />
        <PlayButton playing={p.playing} disabled={p.disabled} onPress={p.onPlayPause} />
        <Side label="+ Sounds" hint="Add sounds" disabled={p.adding} onPress={p.onAdd} />
      </View>
    </View>
  );
}

function Side({ label, hint, on, disabled, onPress }: { label: string; hint: string; on?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.side, on && styles.sideOn, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
    >
      <Text style={[styles.sideText, on && styles.sideTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 32, gap: 10 },
  status: { color: colors.dim, fontSize: 14, textAlign: 'center' },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 104, borderRadius: 22, paddingVertical: 11, alignItems: 'center', backgroundColor: colors.raised },
  sideOn: { backgroundColor: colors.accent },
  sideText: { color: colors.accent, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sideTextOn: { color: '#000' },
  disabled: { opacity: 0.4 },
});

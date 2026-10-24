import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../../player/components/theme';

const STEPS = [
  ['Add sounds', 'Open a mix someone shared, or add your own sounds in the Sounds tab.'],
  ['Mix and play', 'Make a mix, set each sound to how loud you like it, and press Play.'],
  ['Fall asleep', 'Start a sleep timer and the sound fades out by itself.'],
];

// Shown once, on the first launch with no mixes yet.
export function Welcome({ onDone }: { onDone: () => void }) {
  return (
    <View style={shared.page}>
      <Text style={shared.title}>Welcome to Noctívago</Text>
      <Text style={shared.help}>Rain, wind and night sounds that you mix yourself. Everything stays on this phone.</Text>
      {STEPS.map(([title, text], i) => (
        <View key={title} style={styles.step}>
          <Text style={styles.number}>{i + 1}</Text>
          <View style={styles.body}>
            <Text style={styles.stepTitle}>{title}</Text>
            <Text style={shared.help}>{text}</Text>
          </View>
        </View>
      ))}
      <Pressable style={shared.button} onPress={onDone} accessibilityRole="button">
        <Text style={shared.buttonText}>Get started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  number: { color: colors.accent, fontSize: 22, fontWeight: '700', width: 24 },
  body: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
});

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../player/components/theme';

// A one-field text dialog (Android has no Alert.prompt): rename, tags…
type Props = {
  /** Shown while set; null hides the dialog. */
  title: string | null;
  initial: string;
  placeholder?: string;
  okLabel?: string;
  onOk: (text: string) => void;
  onCancel: () => void;
};

export function TextPrompt({ title, initial, placeholder, okLabel = 'Save', onOk, onCancel }: Props) {
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [title, initial]);

  return (
    <Modal visible={title != null} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={() => onOk(text)}
          />
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={onCancel}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={() => onOk(text)}>
              <Text style={styles.ok}>{okLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.raised, borderRadius: 16, padding: 20, gap: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  input: { color: colors.text, fontSize: 17, borderBottomWidth: 2, borderBottomColor: colors.accent, paddingVertical: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingVertical: 10, paddingHorizontal: 14 },
  cancel: { color: colors.dim, fontSize: 16 },
  ok: { color: colors.accent, fontSize: 16, fontWeight: '700' },
});

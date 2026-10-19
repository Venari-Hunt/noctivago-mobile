import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../player/components/theme';

// A panel that slides up from the bottom (the sleep timer). Tapping outside
// or Back closes it.
type Props = {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function BottomSheet({ title, visible, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Taps inside the panel stay inside. */}
        <Pressable style={styles.panel} onPress={() => {}}>
          <View style={styles.grip} />
          <Text style={styles.title}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  panel: { backgroundColor: colors.raised, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 16 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.faint },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
});

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../player/components/theme';

// A list of actions for one thing (hold a mix or a sound). Android's Alert
// holds at most three buttons, so menus with more use this.
export type Action = { label: string; destructive?: boolean; onPress: () => void };

type Props = {
  /** Shown while set; null hides the menu. */
  title: string | null;
  actions: Action[];
  onClose: () => void;
};

export function ActionMenu({ title, actions, onClose }: Props) {
  return (
    <Modal visible={title != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.card}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              style={styles.action}
              onPress={() => {
                onClose();
                a.onPress();
              }}
            >
              <Text style={[styles.label, a.destructive && styles.danger]}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.action} onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.raised, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20 },
  title: { color: colors.text, fontSize: 18, fontWeight: '600', paddingVertical: 8 },
  action: { paddingVertical: 14 },
  label: { color: colors.text, fontSize: 17 },
  danger: { color: colors.danger },
  cancel: { color: colors.dim, fontSize: 17 },
});

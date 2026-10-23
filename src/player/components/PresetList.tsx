import { logError } from '../../errorLog';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { soundsSummary } from '../domain/mixEdit';
import { createPreset, importFromPicker, listPresets, type SavedPreset } from '../storage';
import { PresetMenu } from './PresetMenu';
import { colors, shared } from './theme';

type Props = { onOpen: (preset: SavedPreset) => void };

// The Mixes tab: mixes made here and presets imported from the PC. The
// page around it is the home screen.
export function PresetList({ onOpen }: Props) {
  const [presets, setPresets] = useState(listPresets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<SavedPreset | null>(null);
  const reload = () => setPresets(listPresets());

  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      const saved = await importFromPicker();
      if (saved) reload();
    } catch (e) {
      logError('import mix', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.buttons}>
        <Pressable style={[shared.button, styles.half]} onPress={() => onOpen(createPreset())}>
          <Text style={shared.buttonText}>New mix</Text>
        </Pressable>
        <Pressable style={[shared.secondary, styles.half, busy && styles.busy]} onPress={add} disabled={busy}>
          <Text style={shared.secondaryText}>{busy ? 'Importing…' : 'Import preset'}</Text>
        </Pressable>
      </View>
      {error && <Text style={shared.error}>{error}</Text>}
      <FlatList
        data={presets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={shared.help}>
            Tap New mix to build one from your own sounds (Sounds tab). Or bring a mix from the PC: in Noctívago, open
            Export, choose "For phone", save, send that file to this phone, then tap Import preset.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => onOpen(item)} onLongPress={() => setMenu(item)}>
            <View style={styles.itemText}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.summary} numberOfLines={1}>{soundsSummary(item.sounds)}</Text>
            </View>
            <Pressable onPress={() => setMenu(item)} hitSlop={12} accessibilityLabel={`Options for ${item.name}`}>
              <Text style={styles.dots}>⋯</Text>
            </Pressable>
          </Pressable>
        )}
      />
      <PresetMenu
        preset={menu}
        onClose={() => setMenu(null)}
        onRenamed={reload}
        onCopied={reload}
        onDeleted={reload}
        onError={setError}
      />
    </>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  busy: { opacity: 0.5 },
  list: { gap: 10, paddingBottom: 24 },
  item: { backgroundColor: colors.card, borderRadius: 14, paddingVertical: 16, paddingLeft: 18, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemText: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
  summary: { color: colors.dim, fontSize: 14 },
  dots: { color: colors.accent, fontSize: 24, paddingHorizontal: 6 },
});

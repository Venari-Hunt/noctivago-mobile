import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
            <Text style={styles.name}>{item.name}</Text>
            <Text style={shared.small}>
              {item.sounds.length} sound{item.sounds.length === 1 ? '' : 's'} · hold for options
            </Text>
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
  item: { backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 4 },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
});

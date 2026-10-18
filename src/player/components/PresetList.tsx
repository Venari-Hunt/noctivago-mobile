import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { deletePreset, importFromPicker, listPresets, type SavedPreset } from '../storage';
import { colors, shared } from './theme';

type Props = { version: string; onOpen: (preset: SavedPreset) => void };

export function PresetList({ version, onOpen }: Props) {
  const [presets, setPresets] = useState(listPresets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      const saved = await importFromPicker();
      if (saved) setPresets(listPresets());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (preset: SavedPreset) =>
    Alert.alert(`Remove "${preset.name}"?`, 'It is deleted from this phone. Import the file again to get it back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deletePreset(preset);
          setPresets(listPresets());
        },
      },
    ]);

  return (
    <View style={shared.page}>
      <Text style={shared.title}>Noctívago</Text>
      <Text style={shared.small}>{version}</Text>
      <Pressable style={[shared.button, busy && styles.busy]} onPress={add} disabled={busy}>
        <Text style={shared.buttonText}>{busy ? 'Importing…' : 'Import preset'}</Text>
      </Pressable>
      {error && <Text style={shared.error}>{error}</Text>}
      <FlatList
        data={presets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={shared.help}>
            On the PC, open a preset in Noctívago, go to Export, choose "For phone", and save. Send that file to this phone
            (cable, Drive, email), then tap Import preset.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => onOpen(item)} onLongPress={() => confirmDelete(item)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={shared.small}>
              {item.sounds.length} sound{item.sounds.length === 1 ? '' : 's'} · hold to remove
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  busy: { opacity: 0.5 },
  list: { gap: 10 },
  item: { backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 4 },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
});

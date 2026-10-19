import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SoundRow } from '../../library/components/SoundRow';
import { addSummary, filterSounds, sortSounds, type LibrarySound } from '../../library/domain/library';
import { addFromPicker, listSounds } from '../../library/storage';
import { colors, shared } from './theme';

// Pick sounds from your library to put in a mix. "From files" adds new ones
// to the library first and picks them.
type Props = {
  visible: boolean;
  onAdd: (sounds: LibrarySound[]) => void;
  onClose: () => void;
};

export function AddSoundsSheet({ visible, onAdd, onClose }: Props) {
  const [sounds, setSounds] = useState<LibrarySound[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSounds(listSounds());
    setPicked(new Set());
    setQuery('');
    setNote(null);
  }, [visible]);

  const shown = useMemo(() => sortSounds(filterSounds(sounds, query), 'newest'), [sounds, query]);

  const toggle = (id: string) =>
    setPicked((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const fromFiles = async () => {
    setNote(null);
    setBusy('Opening…');
    try {
      const result = await addFromPicker((done, total) => setBusy(`Adding ${done} of ${total}…`));
      if (!result) return;
      setSounds(listSounds());
      setPicked((old) => new Set([...old, ...result.added.map((s) => s.id)]));
      if (result.failed.length > 0) setNote(addSummary(result.added.length, result.failed));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const chosen = sounds.filter((s) => picked.has(s.id));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={shared.page}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
          <Text style={shared.title}>Add sounds</Text>
          <View style={styles.spacer} />
        </View>
        <Pressable style={[shared.secondary, busy && styles.busy]} onPress={fromFiles} disabled={!!busy}>
          <Text style={shared.secondaryText}>{busy ?? 'From files on this phone'}</Text>
        </Pressable>
        {note && <Text style={shared.error}>{note}</Text>}
        {sounds.length > 0 && (
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search names and tags"
            placeholderTextColor={colors.faint}
          />
        )}
        <FlatList
          data={shown}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={shared.help}>
              {sounds.length > 0 ? 'No sound matches that search.' : 'Your library is empty. Tap "From files on this phone" to add sounds.'}
            </Text>
          }
          renderItem={({ item }) => (
            <SoundRow sound={item} previewing={false} selected={picked.has(item.id)} onPress={() => toggle(item.id)} />
          )}
        />
        <Pressable
          style={[shared.button, chosen.length === 0 && styles.busy]}
          disabled={chosen.length === 0}
          onPress={() => onAdd(chosen)}
        >
          <Text style={shared.buttonText}>
            {chosen.length === 0 ? 'Pick sounds to add' : `Add ${chosen.length} sound${chosen.length === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: colors.accent, fontSize: 16 },
  spacer: { width: 50 },
  busy: { opacity: 0.5 },
  list: { gap: 10, paddingBottom: 12 },
  search: { color: colors.text, fontSize: 16, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
});

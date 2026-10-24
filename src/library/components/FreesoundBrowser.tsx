import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shared } from '../../player/components/theme';
import { licenseLabel, type FreesoundResult } from '../domain/freesound';
import { formatLength } from '../domain/library';
import { addFromFreesound, previewLink, searchFreesound } from '../freesound';
import type { PreviewPlayer } from '../preview';

type Props = {
  preview: PreviewPlayer;
  onClose: () => void;
  /** Called after a sound lands in the library. */
  onAdded: () => void;
};

// Search Freesound, listen to a result, add it to your sounds. One page of
// 15 at a time, more on "Load more" (the desktop's page size).
export function FreesoundBrowser({ preview, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [results, setResults] = useState<FreesoundResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [previewing, setPreviewing] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const search = useRef(0);

  useEffect(
    () => () => {
      preview.stop().catch(() => {});
    },
    [preview],
  );

  const run = async (text: string, nextPage: number) => {
    const ticket = ++search.current;
    setLoading(true);
    setNote(null);
    try {
      const found = await searchFreesound(text, nextPage);
      if (ticket !== search.current) return;
      setResults((old) => (nextPage === 1 ? found.results : [...old, ...found.results]));
      setPage(nextPage);
      setHasMore(found.hasMore);
      setSearched(text);
      if (nextPage === 1 && found.results.length === 0) setNote({ text: 'Nothing found. Try other words (in English works best).', error: false });
    } catch (e) {
      if (ticket === search.current) setNote({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      if (ticket === search.current) setLoading(false);
    }
  };

  const submit = () => {
    const text = query.trim();
    if (text) run(text, 1);
  };

  const togglePreview = async (r: FreesoundResult) => {
    if (previewing === r.id) {
      setPreviewing(null);
      await preview.stop();
      return;
    }
    setPreviewing(r.id);
    try {
      await preview.playUri(`freesound-${r.id}`, previewLink(r));
    } catch {
      setPreviewing(null);
      setNote({ text: `Couldn't play "${r.name}".`, error: true });
    }
  };

  const add = async (r: FreesoundResult) => {
    setAdding(r.id);
    setNote(null);
    try {
      const result = await addFromFreesound(r);
      if (result.added.length === 0) throw new Error(`Couldn't add "${r.name}".`);
      setAdded((old) => new Set(old).add(r.id));
      onAdded();
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={shared.page}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.link}>‹ Done</Text>
        </Pressable>
        <Text style={shared.title}>Browse Freesound</Text>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="Rain, birds, fireplace…"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          autoFocus
        />
        {note && <Text style={note.error ? shared.error : styles.note}>{note.text}</Text>}
        {note?.error && !loading && query.trim() !== '' && (
          <Pressable style={shared.secondary} onPress={submit} accessibilityRole="button">
            <Text style={shared.secondaryText}>Try again</Text>
          </Pressable>
        )}
        <FlatList
          data={results}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? undefined : (
              <Text style={shared.help}>
                Free sounds from freesound.org. Tap one to listen, then Add to keep it in your sounds. Each sound keeps its author and license; some licenses ask you to credit the author if you share what you make.
              </Text>
            )
          }
          ListFooterComponent={
            loading ? (
              <Text style={styles.note}>Searching…</Text>
            ) : hasMore ? (
              <Pressable style={shared.secondary} onPress={() => run(searched, page + 1)}>
                <Text style={shared.secondaryText}>Load more</Text>
              </Pressable>
            ) : undefined
          }
          renderItem={({ item }) => {
            const on = previewing === item.id;
            const done = added.has(item.id);
            const details = [formatLength(item.durationSeconds), `by ${item.username}`, licenseLabel(item.license)].filter(Boolean).join(' · ');
            return (
              <View style={[styles.item, on && styles.on]}>
                <Pressable
                  style={styles.main}
                  onPress={() => togglePreview(item)}
                  onLongPress={() => Linking.openURL(item.pageUrl)}
                  accessibilityLabel={`${item.name}, ${on ? 'playing, tap to stop' : 'tap to listen'}, hold to open on freesound.org`}
                >
                  <Text style={[styles.icon, on && styles.onIcon]}>{on ? '■' : '▶'}</Text>
                  <View style={styles.text}>
                    <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                    <Text style={shared.small} numberOfLines={1}>{details}</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.add, (done || adding !== null) && styles.busy]}
                  onPress={() => add(item)}
                  disabled={done || adding !== null}
                  hitSlop={8}
                >
                  <Text style={styles.addText}>{done ? 'Added' : adding === item.id ? 'Adding…' : 'Add'}</Text>
                </Pressable>
              </View>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.accent, fontSize: 17 },
  note: { color: colors.dim, fontSize: 15 },
  search: { color: colors.text, fontSize: 16, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  list: { gap: 10, paddingBottom: 24 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, paddingRight: 12 },
  on: { backgroundColor: colors.raised },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  icon: { color: colors.faint, fontSize: 18, width: 22, textAlign: 'center' },
  onIcon: { color: colors.accent },
  text: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  add: { borderColor: colors.accent, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  busy: { opacity: 0.5 },
});

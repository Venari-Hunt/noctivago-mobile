import { logError } from '../../errorLog';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shared } from '../../player/components/theme';
import type { SavedPreset } from '../../player/storage';
import { Choice } from '../../ui/Choice';
import { downloadCommunity, listCommunity } from '../client';
import { formatSize, presetDetails, type CommunityPreset, type CommunitySort } from '../domain/community';

type Props = {
  /** Opens a downloaded preset in the player. */
  onOpen: (preset: SavedPreset) => void;
};

const SORTS: { value: CommunitySort; label: string }[] = [
  { value: 'new', label: 'Newest' },
  { value: 'popular', label: 'Popular' },
];

// Presets shared from the PC app. Tap one to download it into Mixes and
// play it. Sharing your own happens on the PC.
export function CommunityList({ onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CommunitySort>('new');
  const [results, setResults] = useState<CommunityPreset[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const ticket = useRef(0);

  const load = async (nextPage: number, text = query, by = sort) => {
    const mine = ++ticket.current;
    setLoading(true);
    setError(null);
    try {
      const found = await listCommunity(text, by, nextPage);
      if (mine !== ticket.current) return;
      setResults((old) => (nextPage === 1 ? found.results : [...old, ...found.results]));
      setPage(nextPage);
      setHasMore(found.hasMore);
    } catch (e) {
      logError('community list', e);
      if (mine === ticket.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // Only on first show; search and sort reload on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeSort = (next: CommunitySort) => {
    setSort(next);
    load(1, query, next);
  };

  const download = (p: CommunityPreset) => {
    const size = formatSize(p.sizeBytes);
    Alert.alert(`Download "${p.name}"?`, `${size ? `Up to ${size} to download (only its phone copy, usually much less). ` : ''}It goes into Mixes and starts in the player.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Download',
        onPress: async () => {
          setDownloading(p.id);
          setError(null);
          try {
            onOpen(await downloadCommunity(p.id));
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setDownloading(null);
          }
        },
      },
    ]);
  };

  return (
    <>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => load(1)}
        placeholder="Search presets"
        placeholderTextColor={colors.faint}
        returnKeyType="search"
      />
      <Choice options={SORTS} value={sort} onChange={changeSort} />
      {error && <Text style={shared.error}>{error}</Text>}
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={shared.help}>
              {error ? 'Tap search on the keyboard to try again.' : 'No presets found. People share them from the PC app (Community tab).'}
            </Text>
          )
        }
        ListFooterComponent={
          loading ? (
            <Text style={styles.note}>Loading…</Text>
          ) : hasMore ? (
            <Pressable style={shared.secondary} onPress={() => load(page + 1)}>
              <Text style={shared.secondaryText}>Load more</Text>
            </Pressable>
          ) : undefined
        }
        renderItem={({ item }) => {
          const busy = downloading === item.id;
          return (
            <Pressable
              style={[styles.item, busy && styles.on, downloading !== null && !busy && styles.dim]}
              onPress={() => download(item)}
              disabled={downloading !== null}
              accessibilityLabel={`${item.name}, ${presetDetails(item)}, tap to download`}
            >
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={shared.small} numberOfLines={1}>{busy ? 'Downloading…' : presetDetails(item)}</Text>
              {item.description ? <Text style={styles.description} numberOfLines={2}>{item.description}</Text> : null}
              {item.tags.length > 0 && <Text style={styles.tags} numberOfLines={1}>{item.tags.join(', ')}</Text>}
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  search: { color: colors.text, fontSize: 16, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  note: { color: colors.dim, fontSize: 15 },
  list: { gap: 10, paddingBottom: 24 },
  item: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 4 },
  on: { backgroundColor: colors.raised },
  dim: { opacity: 0.5 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  description: { color: colors.dim, fontSize: 14 },
  tags: { color: colors.accent, fontSize: 12 },
});

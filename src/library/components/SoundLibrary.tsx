import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shared } from '../../player/components/theme';
import { Choice } from '../../ui/Choice';
import { TextPrompt } from '../../ui/TextPrompt';
import { addSummary, filterSounds, parseTags, sortSounds, type LibrarySound, type SortBy } from '../domain/library';
import { checkLink } from '../domain/link';
import type { PreviewPlayer } from '../preview';
import { addFromLink, addFromPicker, deleteSound, listSounds, saveSound, type AddResult } from '../storage';
import { SoundRow } from './SoundRow';

type Props = {
  preview: PreviewPlayer;
  /** Bumped when sounds were added from outside (Share, Open with). */
  version: number;
};

type Prompt = { kind: 'rename' | 'tags'; sound: LibrarySound } | null;

const SORTS: { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'length', label: 'Length' },
];

export function SoundLibrary({ preview, version }: Props) {
  const [sounds, setSounds] = useState(listSounds);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [askingLink, setAskingLink] = useState(false);

  const reload = () => setSounds(listSounds());
  useEffect(reload, [version]);
  useEffect(
    () => () => {
      preview.stop().catch(() => {});
    },
    [preview],
  );

  const shown = useMemo(() => sortSounds(filterSounds(sounds, query), sortBy), [sounds, query, sortBy]);

  const runAdd = async (label: string, adding: () => Promise<AddResult | null>) => {
    setNote(null);
    setBusy(label);
    try {
      const result = await adding();
      if (result) {
        reload();
        setNote({ text: addSummary(result.added.length, result.failed), error: result.added.length === 0 });
      }
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  const add = () => runAdd('Opening…', () => addFromPicker((done, total) => setBusy(`Adding ${done} of ${total}…`)));

  const addLink = (text: string) => {
    setAskingLink(false);
    const link = checkLink(text);
    if (!link.ok) {
      setNote({ text: link.error, error: true });
      return;
    }
    runAdd('Downloading…', () => addFromLink(link.url));
  };

  const togglePreview = async (sound: LibrarySound) => {
    if (previewing === sound.id) {
      setPreviewing(null);
      await preview.stop();
      return;
    }
    setPreviewing(sound.id);
    try {
      await preview.play(sound);
    } catch {
      setPreviewing(null);
      setNote({ text: `Couldn't play "${sound.name}".`, error: true });
    }
  };

  const remove = (sound: LibrarySound) =>
    Alert.alert(`Delete "${sound.name}"?`, 'It is removed from this phone. Add the file again to get it back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (previewing === sound.id) {
            setPreviewing(null);
            await preview.stop();
          }
          deleteSound(sound);
          reload();
        },
      },
    ]);

  const options = (sound: LibrarySound) =>
    Alert.alert(sound.name, undefined, [
      { text: 'Rename', onPress: () => setPrompt({ kind: 'rename', sound }) },
      { text: 'Edit tags', onPress: () => setPrompt({ kind: 'tags', sound }) },
      { text: 'Delete', style: 'destructive', onPress: () => remove(sound) },
    ], { cancelable: true });

  const finishPrompt = (text: string) => {
    if (!prompt) return;
    const { kind, sound } = prompt;
    if (kind === 'rename') {
      const name = text.trim();
      if (name) saveSound({ ...sound, name });
    } else {
      saveSound({ ...sound, tags: parseTags(text) });
    }
    setPrompt(null);
    reload();
  };

  return (
    <>
      <View style={styles.buttons}>
        <Pressable style={[shared.button, styles.half, busy && styles.busy]} onPress={add} disabled={!!busy}>
          <Text style={shared.buttonText}>{busy ?? 'Add sounds'}</Text>
        </Pressable>
        <Pressable
          style={[shared.secondary, styles.half, busy && styles.busy]}
          onPress={() => {
            setNote(null);
            setAskingLink(true);
          }}
          disabled={!!busy}
        >
          <Text style={shared.secondaryText}>From a link</Text>
        </Pressable>
      </View>
      {note && <Text style={note.error ? shared.error : styles.note}>{note.text}</Text>}
      {sounds.length > 0 && (
        <>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search names and tags"
            placeholderTextColor={colors.faint}
            clearButtonMode="while-editing"
          />
          <Choice options={SORTS} value={sortBy} onChange={setSortBy} />
        </>
      )}
      <FlatList
        data={shown}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={shared.help}>
            {sounds.length > 0
              ? 'No sound matches that search.'
              : 'Tap Add sounds and pick audio files from this phone (MP3, WAV, FLAC, OGG, Opus, M4A). From a link takes a direct link to an audio file. You can also share a file to Noctívago from another app. Tap a sound to listen; hold it to rename, tag or delete.'}
          </Text>
        }
        renderItem={({ item }) => (
          <SoundRow sound={item} previewing={previewing === item.id} onPress={() => togglePreview(item)} onLongPress={() => options(item)} />
        )}
      />
      <TextPrompt
        title={prompt ? (prompt.kind === 'rename' ? 'Rename sound' : 'Tags, separated by commas') : null}
        initial={prompt ? (prompt.kind === 'rename' ? prompt.sound.name : prompt.sound.tags.join(', ')) : ''}
        placeholder={prompt?.kind === 'tags' ? 'rain, night' : undefined}
        onOk={finishPrompt}
        onCancel={() => setPrompt(null)}
      />
      <TextPrompt
        title={askingLink ? 'Link to an audio file' : null}
        initial=""
        placeholder="https://…/rain.mp3"
        okLabel="Add"
        onOk={addLink}
        onCancel={() => setAskingLink(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  busy: { opacity: 0.5 },
  note: { color: colors.dim, fontSize: 15 },
  list: { gap: 10, paddingBottom: 24 },
  search: { color: colors.text, fontSize: 16, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
});

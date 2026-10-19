import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert } from 'react-native';
import { ActionMenu } from '../../ui/ActionMenu';
import { TextPrompt } from '../../ui/TextPrompt';
import { copyPreset, deletePreset, renamePreset, writeShareFile, type SavedPreset } from '../storage';

// Hold a mix (in Mixes, or ⋯ in the player): rename, save a copy, share,
// delete. Shared by both screens so they behave the same.
type Props = {
  /** Shown while set; null hides the menu. */
  preset: SavedPreset | null;
  onClose: () => void;
  onRenamed: (preset: SavedPreset) => void;
  onCopied: (copy: SavedPreset) => void;
  onDeleted: (preset: SavedPreset) => void;
  onError: (message: string) => void;
};

type Prompt = { kind: 'rename' | 'copy'; preset: SavedPreset } | null;

export async function sharePreset(preset: SavedPreset) {
  const uri = await writeShareFile(preset);
  await Sharing.shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: `Share "${preset.name}"` });
}

export function PresetMenu({ preset, onClose, onRenamed, onCopied, onDeleted, onError }: Props) {
  const [prompt, setPrompt] = useState<Prompt>(null);
  const fail = (e: unknown) => onError(e instanceof Error ? e.message : String(e));

  const confirmDelete = (p: SavedPreset) =>
    Alert.alert(`Delete "${p.name}"?`, 'It is deleted from this phone. Share it first if you want to keep a copy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePreset(p);
          onDeleted(p);
        },
      },
    ]);

  const finish = (text: string) => {
    if (!prompt) return;
    const name = text.trim();
    const { kind, preset: p } = prompt;
    setPrompt(null);
    if (!name) return;
    if (kind === 'rename') onRenamed(renamePreset(p, name));
    else copyPreset(p, name).then(onCopied, fail);
  };

  const actions = preset
    ? [
        { label: 'Rename', onPress: () => setPrompt({ kind: 'rename', preset }) },
        { label: 'Save a copy', onPress: () => setPrompt({ kind: 'copy', preset }) },
        { label: 'Share', onPress: () => sharePreset(preset).catch(fail) },
        { label: 'Delete', destructive: true, onPress: () => confirmDelete(preset) },
      ]
    : [];

  return (
    <>
      <ActionMenu title={preset?.name ?? null} actions={actions} onClose={onClose} />
      <TextPrompt
        title={prompt ? (prompt.kind === 'rename' ? 'Rename mix' : 'Name of the copy') : null}
        initial={prompt ? (prompt.kind === 'rename' ? prompt.preset.name : `${prompt.preset.name} copy`) : ''}
        okLabel={prompt?.kind === 'copy' ? 'Save copy' : 'Save'}
        onOk={finish}
        onCancel={() => setPrompt(null)}
      />
    </>
  );
}

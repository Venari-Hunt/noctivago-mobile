import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CommunityList } from '../../community/components/CommunityList';
import { SoundLibrary } from '../../library/components/SoundLibrary';
import type { PreviewPlayer } from '../../library/preview';
import { PresetList } from '../../player/components/PresetList';
import { colors, shared } from '../../player/components/theme';
import type { SavedPreset } from '../../player/storage';
import { useSettings } from '../../settings/store';
import { Choice } from '../../ui/Choice';

export type HomeTab = 'mixes' | 'sounds' | 'community';

const TABS: { value: HomeTab; label: string }[] = [
  { value: 'mixes', label: 'Mixes' },
  { value: 'sounds', label: 'Sounds' },
  { value: 'community', label: 'Community' },
];

type Props = {
  version: string;
  tab: HomeTab;
  onTab: (tab: HomeTab) => void;
  preview: PreviewPlayer;
  libraryVersion: number;
  onOpen: (preset: SavedPreset) => void;
  onSettings: () => void;
};

// The home screen: your mixes (presets), your sounds (the library), and
// presets people shared (Community, unless switched off in Settings).
export function Home({ version, tab, onTab, preview, libraryVersion, onOpen, onSettings }: Props) {
  const { community } = useSettings();
  const tabs = community ? TABS : TABS.filter((t) => t.value !== 'community');
  const shown = tabs.some((t) => t.value === tab) ? tab : 'mixes';
  return (
    <View style={shared.page}>
      <View style={styles.top}>
        <Text style={shared.title}>Noctívago</Text>
        <Pressable onPress={onSettings} hitSlop={12} accessibilityRole="button">
          <Text style={styles.settings}>Settings</Text>
        </Pressable>
      </View>
      <Text style={shared.small}>{version}</Text>
      <Choice options={tabs} value={shown} onChange={onTab} big />
      {shown === 'mixes' && <PresetList onOpen={onOpen} />}
      {shown === 'sounds' && <SoundLibrary preview={preview} version={libraryVersion} />}
      {shown === 'community' && <CommunityList onOpen={onOpen} />}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settings: { color: colors.accent, fontSize: 17 },
});

import { Text, View } from 'react-native';
import { CommunityList } from '../../community/components/CommunityList';
import { SoundLibrary } from '../../library/components/SoundLibrary';
import type { PreviewPlayer } from '../../library/preview';
import { PresetList } from '../../player/components/PresetList';
import { shared } from '../../player/components/theme';
import type { SavedPreset } from '../../player/storage';
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
};

// The home screen: your mixes (presets), your sounds (the library), and
// presets people shared (Community).
export function Home({ version, tab, onTab, preview, libraryVersion, onOpen }: Props) {
  return (
    <View style={shared.page}>
      <Text style={shared.title}>Noctívago</Text>
      <Text style={shared.small}>{version}</Text>
      <Choice options={TABS} value={tab} onChange={onTab} big />
      {tab === 'mixes' && <PresetList onOpen={onOpen} />}
      {tab === 'sounds' && <SoundLibrary preview={preview} version={libraryVersion} />}
      {tab === 'community' && <CommunityList onOpen={onOpen} />}
    </View>
  );
}

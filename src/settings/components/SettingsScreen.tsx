import { useEffect, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, shared } from '../../player/components/theme';
import { presetLabel } from '../../player/domain/sleepTimer';
import { Choice } from '../../ui/Choice';
import { SliderRow } from '../../ui/SliderRow';
import type { UpdateState } from '../../updates/useAutoUpdate';
import { AUTO_SLEEP_CHOICES, FADE_CHOICES, fadeLabel } from '../domain/settings';
import { setSettings, useSettings } from '../store';

const REPO = 'https://github.com/Venari-Hunt/noctivago-mobile';

type Props = { update: UpdateState; onBack: () => void };

// Settings, laid out like the desktop's: updates, sleep timer, player, new sounds,
// and on/off switches for the phone versions of the PC's core plugins.
export function SettingsScreen({ update, onBack }: Props) {
  const s = useSettings();
  const [volume, setVolume] = useState(s.newSoundVolume);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => back.remove();
  }, [onBack]);

  return (
    <View style={shared.page}>
      <View style={styles.top}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={shared.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        <Section title="Updates">
          <Text style={shared.small}>{update.label}</Text>
          {update.pending ? (
            <Pressable style={shared.secondary} onPress={update.restart}>
              <Text style={shared.secondaryText}>Restart to update</Text>
            </Pressable>
          ) : (
            <Pressable style={shared.secondary} onPress={update.checkNow}>
              <Text style={shared.secondaryText}>Check for updates</Text>
            </Pressable>
          )}
          {update.status && <Text style={shared.help}>{update.status}</Text>}
          <Toggle
            label="Install updates automatically"
            help="Restarts into a new version when it's downloaded, never while playing."
            value={s.autoInstallUpdates}
            onChange={(v) => setSettings({ autoInstallUpdates: v })}
          />
        </Section>

        <Section title="Sleep timer">
          <Text style={styles.label}>Fade out over</Text>
          <Choice
            options={FADE_CHOICES.map((f) => ({ value: String(f), label: fadeLabel(f) }))}
            value={String(s.sleepFadeSeconds)}
            onChange={(v) => setSettings({ sleepFadeSeconds: Number(v) })}
          />
          <Text style={styles.label}>Start a timer every time you press Play</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Choice
              options={AUTO_SLEEP_CHOICES.map((m) => ({ value: String(m), label: m === 0 ? 'Off' : presetLabel(m) }))}
              value={String(s.sleepAutoMinutes)}
              onChange={(v) => setSettings({ sleepAutoMinutes: Number(v) })}
            />
          </ScrollView>
        </Section>

        <Section title="Player">
          <Toggle
            label="Show playback check"
            help="A line under the sounds: how long audio kept running and battery use per hour. For overnight tests."
            value={s.showPlaybackCheck}
            onChange={(v) => setSettings({ showPlaybackCheck: v })}
          />
        </Section>

        <Section title="New sounds">
          <SliderRow
            label="Volume when added to a mix"
            value={volume}
            text={`${Math.round(volume * 100)}%`}
            onChange={setVolume}
            onDone={(v) => setSettings({ newSoundVolume: v })}
          />
        </Section>

        <Section title="Plugins">
          <Text style={shared.help}>Phone versions of the PC app's plugins. Off hides them.</Text>
          <Toggle
            label="Browse Sounds"
            help="Search and add free sounds from Freesound (Sounds tab)."
            value={s.browseSounds}
            onChange={(v) => setSettings({ browseSounds: v })}
          />
          <Toggle
            label="Community"
            help="Download presets other people shared (Community tab)."
            value={s.community}
            onChange={(v) => setSettings({ community: v })}
          />
        </Section>

        <Section title="About">
          <Link text="What's new" url={`${REPO}/blob/master/CHANGELOG.md`} />
          <Link text="Source code and license (Apache 2.0)" url={REPO} />
          <Text style={shared.help}>Freesound sounds keep their author and license; you'll see them under each sound.</Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}

function Toggle({ label, help, value, onChange }: { label: string; help: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={shared.small}>{help}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.raised, true: colors.accent }}
        thumbColor={value ? '#000' : colors.faint}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Link({ text, url }: { text: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="link">
      <Text style={styles.link}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { color: colors.accent, fontSize: 17 },
  list: { gap: 28, paddingBottom: 48 },
  section: { gap: 12 },
  heading: { color: colors.dim, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  label: { color: colors.text, fontSize: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleText: { flex: 1, gap: 2 },
  link: { color: colors.accent, fontSize: 16 },
});

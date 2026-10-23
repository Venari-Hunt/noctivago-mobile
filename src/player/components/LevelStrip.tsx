import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CLIP_THRESHOLD, dbText, FLOOR_DB, isClipping, latchClip, suggestedLowerDb, toDb, type ClipLatch } from '../domain/levels';
import type { PlayerEngine } from '../engine';
import { colors } from './theme';

// How loud the mix is, and when it is too loud. The mix passes a soft limiter
// that bends anything past -1 dB, squashing the whole mix under each loud
// sound (thunder), which sounds like the other sounds ducking. The bar shows
// the level going in; a clip stays on screen until you dismiss it, with the
// loudest groups and one tap to lower every sound. Polls only while playing
// with the screen on, in its own component so the sound list never re-renders.
type Props = {
  engine: PlayerEngine;
  playing: boolean;
  groupNames: string[];
  /** Lower every sound by this many dB. */
  onLower: (db: number) => void;
};

const POLL_MS = 100;
const TOP_DB = 6;
const RED = '#ff6b6b';
const pos = (db: number) => Math.max(0, Math.min(1, (db - FLOOR_DB) / (TOP_DB - FLOOR_DB)));

export function LevelStrip({ engine, playing, groupNames, onLower }: Props) {
  const [db, setDb] = useState(FLOOR_DB);
  const [latch, setLatch] = useState<ClipLatch | null>(null);
  const held = useRef(FLOOR_DB);

  useEffect(() => {
    if (!playing) {
      held.current = FLOOR_DB;
      setDb(FLOOR_DB);
      return;
    }
    engine.readLevels(); // starts the meters
    const id = setInterval(() => {
      const levels = engine.readLevels();
      const now = toDb(levels.mix);
      // Rises at once, falls a little at a time, like a meter.
      held.current = Math.max(now, held.current - 3);
      setDb(held.current);
      setLatch((l) => latchClip(l, levels.mix, levels.groups));
    }, POLL_MS);
    return () => clearInterval(id);
  }, [engine, playing]);

  if (!playing && !latch) return null;
  const hot = db > toDb(CLIP_THRESHOLD);
  const peakDb = latch ? toDb(latch.peak) : 0;
  const lowerBy = suggestedLowerDb(peakDb);
  const hotNames = latch?.hotGroups.map((g) => groupNames[g]).filter(Boolean) ?? [];

  return (
    <View style={styles.wrap}>
      {playing && (
        <View style={styles.row} accessibilityLabel={`Mix level ${dbText(db)}`}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pos(db) * 100}%`, backgroundColor: hot ? RED : colors.accent }]} />
            <View style={[styles.tick, { left: `${pos(toDb(CLIP_THRESHOLD)) * 100}%` }]} />
          </View>
          <Text style={[styles.level, hot && { color: RED }]}>{dbText(db)}</Text>
        </View>
      )}
      {latch && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Too loud: peaks reached {dbText(peakDb)}</Text>
          <Text style={styles.bannerText}>
            Past -1 dB the limiter squashes the whole mix under each loud sound, so other sounds seem to duck.
            {hotNames.length > 0 ? ` Loudest: ${hotNames.join(', ')}.` : ''}
          </Text>
          <View style={styles.buttons}>
            <Pressable
              style={styles.primary}
              onPress={() => {
                onLower(lowerBy);
                setLatch(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Lower all sounds {lowerBy} dB</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setLatch(null)} accessibilityRole="button">
              <Text style={styles.secondaryText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingHorizontal: 24, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  tick: { position: 'absolute', top: 0, width: 2, height: 6, backgroundColor: colors.faint },
  level: { color: colors.faint, fontSize: 13, minWidth: 64, textAlign: 'right' },
  banner: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: RED, padding: 12, gap: 8 },
  bannerTitle: { color: RED, fontSize: 15, fontWeight: '700' },
  bannerText: { color: colors.dim, fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primary: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  primaryText: { color: '#000', fontSize: 15, fontWeight: '700' },
  secondary: { borderColor: colors.faint, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  secondaryText: { color: colors.text, fontSize: 15 },
});

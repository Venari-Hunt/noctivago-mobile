import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CLIP_THRESHOLD, FLOOR_DB, toDb } from '../domain/levels';
import type { PlayerEngine } from '../engine';
import { colors } from './theme';

// One sound's level bar, under its name: how loud it is after its volume,
// before its group and the limiter. Polls only while playing with the screen
// on, in its own component so the sound list never re-renders.
type Props = { engine: PlayerEngine; soundKey: string; playing: boolean };

const POLL_MS = 150;
const TOP_DB = 6;
const RED = '#ff6b6b';
const pos = (db: number) => Math.max(0, Math.min(1, (db - FLOOR_DB) / (TOP_DB - FLOOR_DB)));

export function SoundMeter({ engine, soundKey, playing }: Props) {
  const [db, setDb] = useState(FLOOR_DB);
  const held = useRef(FLOOR_DB);

  useEffect(() => {
    held.current = FLOOR_DB;
    setDb(FLOOR_DB);
    if (!playing) return;
    const id = setInterval(() => {
      const now = toDb(engine.readSoundLevels().get(soundKey) ?? 0);
      // Rises at once, falls a little at a time, like the mix meter.
      held.current = Math.max(now, held.current - 4);
      setDb((was) => (Math.abs(was - held.current) < 0.5 ? was : held.current));
    }, POLL_MS);
    return () => clearInterval(id);
  }, [engine, soundKey, playing]);

  const hot = db > toDb(CLIP_THRESHOLD);
  return (
    <View style={styles.track} accessibilityLabel="Sound level">
      <View style={[styles.fill, { width: `${pos(db) * 100}%`, backgroundColor: hot ? RED : colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { CLIP_THRESHOLD, FLOOR_DB, toDb } from '../domain/levels';
import type { PlayerEngine } from '../engine';
import { colors } from './theme';

// One sound's level bar, under its name: how loud it is after its volume,
// before its group and the limiter. One shared poll reads every sound's level
// at once (not one timer per bar), and each bar glides on the native thread,
// so nothing re-renders while the meters move.
type Props = { engine: PlayerEngine; soundKey: string; playing: boolean };

const POLL_MS = 100;
const TOP_DB = 6;
const RED = '#ff6b6b';
const pos = (db: number) => Math.max(0, Math.min(1, (db - FLOOR_DB) / (TOP_DB - FLOOR_DB)));

type Listener = (db: number) => void;
const listeners = new Map<string, Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
const held = new Map<string, number>();

function subscribe(engine: PlayerEngine, key: string, on: Listener) {
  listeners.set(key, on);
  if (!timer) {
    timer = setInterval(() => {
      const levels = engine.readSoundLevels();
      listeners.forEach((fn, k) => {
        const now = toDb(levels.get(k) ?? 0);
        // Rises at once, falls a little at a time, like the mix meter.
        const db = Math.max(now, (held.get(k) ?? FLOOR_DB) - 4);
        held.set(k, db);
        fn(db);
      });
    }, POLL_MS);
  }
  return () => {
    listeners.delete(key);
    held.delete(key);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function SoundMeter({ engine, soundKey, playing }: Props) {
  const [width, setWidth] = useState(0);
  const [hot, setHot] = useState(false);
  const level = useRef(new Animated.Value(0)).current; // 0..1 of the track

  useEffect(() => {
    level.setValue(0);
    setHot(false);
    if (!playing) return;
    const hotDb = toDb(CLIP_THRESHOLD);
    let wasHot = false;
    return subscribe(engine, soundKey, (db) => {
      Animated.timing(level, { toValue: pos(db), duration: POLL_MS, easing: Easing.linear, useNativeDriver: true }).start();
      if (db > hotDb !== wasHot) {
        wasHot = db > hotDb;
        setHot(wasHot);
      }
    });
  }, [engine, soundKey, playing, level]);

  // The fill is full width, slid left by the part not lit (a transform, so it runs natively).
  const slide = level.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel="Sound level">
      <Animated.View style={[styles.fill, { backgroundColor: hot ? RED : colors.accent, transform: [{ translateX: slide }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 4, width: '100%' },
});

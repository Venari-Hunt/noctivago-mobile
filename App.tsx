import { StatusBar } from 'expo-status-bar';
import * as Battery from 'expo-battery';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AudioManager } from 'react-native-audio-api';
import { clockReport, type ClockSample } from './src/spike/domain/clockCheck';
import { SpikeEngine } from './src/spike/engine';

type Run = { samples: ClockSample[]; batteryStart: number; batteryNow: number };

export default function App() {
  const engine = useRef(new SpikeEngine());
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${line}`, ...l].slice(0, 30));

  useEffect(() => {
    const sub = AudioManager.addSystemEventListener('interruption', (e) => note(`interruption ${e.type}${e.shouldResume ? ' (resume)' : ''}`));
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(async () => {
      const sample = { wallMs: Date.now(), audioSec: engine.current.currentTime };
      const batteryNow = await Battery.getBatteryLevelAsync();
      setRun((r) => (r ? { ...r, samples: [...r.samples, sample], batteryNow } : r));
    }, 5000);
    return () => clearInterval(id);
  }, [playing]);

  const toggle = async () => {
    try {
      if (playing) {
        await engine.current.stop();
        setPlaying(false);
        note('stopped');
        return;
      }
      await engine.current.start();
      const battery = await Battery.getBatteryLevelAsync();
      setRun({ samples: [{ wallMs: Date.now(), audioSec: engine.current.currentTime }], batteryStart: battery, batteryNow: battery });
      setPlaying(true);
      note(`playing (context ${engine.current.state})`);
    } catch (e) {
      note(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const report = run && clockReport(run.samples);
  const drainPerHour =
    report && report.wallMinutes > 1 ? ((run.batteryStart - run.batteryNow) * 100 * 60) / report.wallMinutes : null;

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Noctívago — background spike</Text>
      <Text style={styles.help}>Press Play, lock the phone for 30 minutes, listen for gaps or clicks, then unlock and read the numbers.</Text>
      <Pressable style={[styles.button, playing && styles.buttonOn]} onPress={toggle}>
        <Text style={styles.buttonText}>{playing ? 'Stop' : 'Play'}</Text>
      </Pressable>
      {report && (
        <View style={styles.box}>
          <Text style={styles.stat}>Wall clock: {report.wallMinutes.toFixed(1)} min</Text>
          <Text style={styles.stat}>Audio clock: {report.audioMinutes.toFixed(1)} min ({(report.ratio * 100).toFixed(1)}%)</Text>
          <Text style={styles.stat}>Worst stall: {report.worstStallSec.toFixed(1)} s</Text>
          <Text style={styles.stat}>Battery: {drainPerHour === null ? 'measuring…' : `${drainPerHour.toFixed(1)}% per hour`}</Text>
        </View>
      )}
      <ScrollView style={styles.log}>
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>{line}</Text>
        ))}
      </ScrollView>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000', padding: 24, paddingTop: 64, gap: 16 },
  title: { color: '#ffc933', fontSize: 22, fontWeight: '700' },
  help: { color: '#bbb', fontSize: 15 },
  button: { backgroundColor: '#ffc933', borderRadius: 12, padding: 18, alignItems: 'center' },
  buttonOn: { backgroundColor: '#333' },
  buttonText: { color: '#000', fontSize: 20, fontWeight: '700' },
  box: { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 16, gap: 6 },
  stat: { color: '#fff', fontSize: 16 },
  log: { flex: 1 },
  logLine: { color: '#888', fontSize: 13, fontFamily: 'monospace' },
});

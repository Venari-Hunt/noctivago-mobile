import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, shared } from '../../player/components/theme';
import { addSummary } from '../domain/library';
import { MAX_RECORDING_SECONDS, MIN_RECORDING_SECONDS, defaultRecordingName, formatClock } from '../domain/recording';
import { cancelRecording, discardRecording, ensureMicrophone, recordedSeconds, saveRecording, startRecording, stopRecording } from '../recorder';

type Props = {
  onClose: () => void;
  /** Called after the recording lands in the library, with the one-line summary. */
  onSaved: (summary: string) => void;
};

type Stage = { kind: 'idle' } | { kind: 'recording' } | { kind: 'recorded'; uri: string; seconds: number } | { kind: 'saving'; uri: string; seconds: number };

// Record a sound with the microphone: Start, Stop, name it, Save. The
// desktop's Record dialog, as a sheet.
export function RecordSheet({ onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [seconds, setSeconds] = useState(0);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const kept = useRef<string | null>(null);

  // Leaving the sheet any way but Save drops the recording.
  useEffect(
    () => () => {
      cancelRecording();
      discardRecording(kept.current);
    },
    [],
  );

  const stopping = useRef(false);
  const stop = async () => {
    // The hour limit and a tap can both land in the same moment.
    if (stopping.current) return;
    stopping.current = true;
    try {
      const done = await stopRecording();
      if (done.seconds < MIN_RECORDING_SECONDS) {
        discardRecording(done.uri);
        setStage({ kind: 'idle' });
        setError('That was too short to keep. Tap Start and hold the phone near the sound.');
        return;
      }
      kept.current = done.uri;
      setSeconds(done.seconds);
      setStage({ kind: 'recorded', ...done });
    } catch (e) {
      setStage({ kind: 'idle' });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      stopping.current = false;
    }
  };

  useEffect(() => {
    if (stage.kind !== 'recording') return;
    const timer = setInterval(() => {
      const now = recordedSeconds();
      setSeconds(now);
      if (now >= MAX_RECORDING_SECONDS) stop();
    }, 250);
    return () => clearInterval(timer);
  }, [stage.kind]);

  const start = async () => {
    setError(null);
    discardRecording(kept.current);
    kept.current = null;
    const problem = await ensureMicrophone();
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await startRecording();
      setSeconds(0);
      setStage({ kind: 'recording' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    if (stage.kind !== 'recorded') return;
    setStage({ ...stage, kind: 'saving' });
    try {
      const result = await saveRecording(stage.uri, name);
      kept.current = null;
      if (result.added.length === 0) {
        setStage({ kind: 'idle' });
        setError("Couldn't read the recording. Try recording again.");
        return;
      }
      onSaved(addSummary(result.added.length, result.failed));
      onClose();
    } catch (e) {
      kept.current = null;
      setStage({ kind: 'idle' });
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const recording = stage.kind === 'recording';
  const hasTake = stage.kind === 'recorded' || stage.kind === 'saving';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={shared.page}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.link}>‹ Cancel</Text>
        </Pressable>
        <Text style={shared.title}>Record a sound</Text>
        <View style={styles.clockRow}>
          {recording && <View style={styles.dot} />}
          <Text style={[styles.clock, recording && styles.live]}>{formatClock(seconds)}</Text>
        </View>
        {recording ? (
          <Pressable style={shared.button} onPress={stop}>
            <Text style={shared.buttonText}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable style={hasTake ? shared.secondary : shared.button} onPress={start} disabled={stage.kind === 'saving'}>
            <Text style={hasTake ? shared.secondaryText : shared.buttonText}>{hasTake ? 'Record again' : 'Start'}</Text>
          </Pressable>
        )}
        {hasTake && (
          <>
            <TextInput
              style={styles.name}
              value={name}
              onChangeText={setName}
              placeholder={defaultRecordingName(new Date())}
              placeholderTextColor={colors.faint}
            />
            <Pressable style={[shared.button, stage.kind === 'saving' && styles.busy]} onPress={save} disabled={stage.kind === 'saving'}>
              <Text style={shared.buttonText}>{stage.kind === 'saving' ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </>
        )}
        {error && <Text style={shared.error}>{error}</Text>}
        {stage.kind === 'idle' && !error && (
          <Text style={shared.help}>
            Records with this phone's microphone. Keep the screen on while recording. Stops by itself after an hour. Leave the name empty to call it by the date.
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.accent, fontSize: 17 },
  clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.danger },
  clock: { color: colors.dim, fontSize: 48, fontWeight: '300', fontVariant: ['tabular-nums'] },
  live: { color: colors.text },
  name: { color: colors.text, fontSize: 16, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  busy: { opacity: 0.5 },
});

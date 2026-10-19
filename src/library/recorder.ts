import { File } from 'expo-file-system';
import { AudioManager, AudioRecorder, FileDirectory, FileFormat, FilePreset } from 'react-native-audio-api';
import { permissionProblem, recordingFileName } from './domain/recording';
import { addFiles, type AddResult } from './storage';

// Records the microphone to an .m4a in the cache, then adds it to your sounds
// through the same path as any picked file (addFiles copies it into the
// library). The recorder comes from react-native-audio-api, the engine the
// player already uses, so no second audio library fights it for the phone's
// audio. One mono channel: phone mics are mono, and it halves the file.

let recorder: AudioRecorder | null = null;

/** Asks for the microphone if needed. Returns what went wrong, or null. */
export async function ensureMicrophone(): Promise<string | null> {
  let status = await AudioManager.checkRecordingPermissions();
  if (status !== 'Granted') status = await AudioManager.requestRecordingPermissions();
  return permissionProblem(status);
}

export async function startRecording(): Promise<void> {
  if (recorder?.isRecording()) return;
  const r = recorder ?? new AudioRecorder();
  recorder = r;
  const output = r.enableFileOutput({
    directory: FileDirectory.Cache,
    subDirectory: 'recordings',
    fileNamePrefix: 'mic',
    channelCount: 1,
    format: FileFormat.M4A,
    preset: FilePreset.Medium,
  });
  if (output.status === 'error') throw new Error(`Couldn't start recording: ${output.message}`);
  const started = await r.start();
  if (started.status === 'error') throw new Error(`Couldn't start recording: ${started.message}`);
}

/** Seconds recorded so far, 0 when not recording. */
export function recordedSeconds(): number {
  return recorder?.isRecording() ? recorder.getCurrentDuration() : 0;
}

/** Stops and returns the recorded file and its length. */
export async function stopRecording(): Promise<{ uri: string; seconds: number }> {
  const r = recorder;
  if (!r) throw new Error('Nothing is recording.');
  const stopped = await r.stop();
  if (stopped.status === 'error') throw new Error(`Recording failed: ${stopped.message}`);
  const uri = stopped.paths[0];
  if (!uri) throw new Error('Recording failed: no file was written.');
  return { uri, seconds: stopped.duration };
}

/** Throws a recording away (Discard, or the sheet closed without saving). */
export function discardRecording(uri: string | null) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

/** Stops a running recording without keeping it. */
export async function cancelRecording() {
  if (!recorder?.isRecording()) return;
  try {
    const { uri } = await stopRecording();
    discardRecording(uri);
  } catch {}
}

/** Adds a finished recording to your sounds under the typed name. */
export async function saveRecording(uri: string, typedName: string): Promise<AddResult> {
  try {
    return await addFiles([{ uri, name: recordingFileName(typedName, new Date()), mimeType: 'audio/mp4' }]);
  } finally {
    discardRecording(uri);
  }
}

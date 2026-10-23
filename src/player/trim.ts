import type { AudioBuffer, BaseAudioContext } from 'react-native-audio-api';

// A decoded clip cut to the frames [start, end) (domain/trimEdit.ts). One
// copy per channel; the original is freed once the caller drops it.
export function trimBuffer(ctx: BaseAudioContext, buffer: AudioBuffer, range: { start: number; end: number } | null): AudioBuffer {
  if (!range) return buffer;
  const out = ctx.createBuffer(buffer.numberOfChannels, range.end - range.start, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.getChannelData(c).set(buffer.getChannelData(c).subarray(range.start, range.end));
  }
  return out;
}

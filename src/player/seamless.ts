import type { AudioBuffer, BaseAudioContext } from 'react-native-audio-api';
import { seamlessPlan, writeSeamless } from './domain/seamlessLoop';

// A decoded clip rearranged into a seamless loop (domain/seamlessLoop.ts).
// getChannelData is a live view of the buffer's memory, so this is one copy
// per channel plus the short blend. The original buffer is freed once the
// caller drops it. Returns the buffer as is when there is nothing to blend.
export function seamlessBuffer(ctx: BaseAudioContext, buffer: AudioBuffer, fadeSeconds: number): AudioBuffer {
  const plan = seamlessPlan(buffer.length, buffer.sampleRate, fadeSeconds);
  if (!plan) return buffer;
  const out = ctx.createBuffer(buffer.numberOfChannels, plan.outLength, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    writeSeamless(buffer.getChannelData(c), out.getChannelData(c), plan);
  }
  return out;
}

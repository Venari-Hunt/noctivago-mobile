import { AudioContext, type AudioBufferSourceNode, type GainNode } from 'react-native-audio-api';
import { loopFadeSeconds } from '../player/domain/seamlessLoop';
import { seamlessBuffer } from '../player/seamless';
import type { LibrarySound } from './domain/library';
import { soundAudioUri } from './storage';

// Plays one library sound on a loop so you can hear it before using it.
// Its own audio context, closed on stop, so nothing stays decoded. Only used
// from the home screen, where the player has already stopped.

const FADE_SECONDS = 0.15;

export class PreviewPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  /** The sound playing (or loading), null when stopped. */
  current: string | null = null;

  async play(sound: LibrarySound) {
    await this.stop();
    this.current = sound.id;
    const ctx = new AudioContext();
    this.ctx = ctx;
    const buffer = await ctx.decodeAudioData(soundAudioUri(sound));
    if (this.ctx !== ctx) return; // stopped while decoding
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const source = ctx.createBufferSource();
    // Loops seamlessly, as it will once added to a mix.
    source.buffer = seamlessBuffer(ctx, buffer, loopFadeSeconds(null, buffer.duration));
    source.loop = true;
    source.connect(gain);
    source.start();
    gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + FADE_SECONDS);
    this.source = source;
    this.gain = gain;
  }

  async stop() {
    const ctx = this.ctx;
    this.ctx = null;
    this.current = null;
    if (!ctx) return;
    const { source, gain } = this;
    this.source = null;
    this.gain = null;
    if (source && gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_SECONDS);
      await new Promise((r) => setTimeout(r, FADE_SECONDS * 1000 + 30));
      source.stop();
    }
    await ctx.close();
  }
}

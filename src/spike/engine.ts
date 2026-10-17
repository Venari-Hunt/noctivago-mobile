import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AudioBufferSourceNode,
} from 'react-native-audio-api';

// Spike graph, the same shape the desktop Mixer uses:
// rain → lowpass ┐
// pad  → gain    ┴→ mix → dry ─────────┬→ master → out
//                     mix → convolver ─┘
export class SpikeEngine {
  private ctx: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];

  get currentTime() {
    return this.ctx?.currentTime ?? 0;
  }

  get state() {
    return this.ctx?.state ?? 'closed';
  }

  async start() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const [rain, pad, room] = await Promise.all([
      ctx.decodeAudioData(require('../../assets/audio/rain.ogg')),
      ctx.decodeAudioData(require('../../assets/audio/pad.ogg')),
      ctx.decodeAudioData(require('../../assets/audio/room.wav')),
    ]);

    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);

    const mix = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    const reverb = ctx.createConvolver();
    reverb.buffer = room;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    mix.connect(dry).connect(master);
    mix.connect(reverb).connect(wet).connect(master);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2500;
    lowpass.connect(mix);
    const padGain = ctx.createGain();
    padGain.gain.value = 0.5;
    padGain.connect(mix);

    for (const [buffer, input] of [[rain, lowpass], [pad, padGain]] as const) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(input);
      source.start();
      this.sources.push(source);
    }

    AudioManager.observeAudioInterruptions(true);
    // Showing the playback notification starts Android's media foreground
    // service, which is what keeps the process (and audio) alive when locked.
    await PlaybackNotificationManager.show({ title: 'Noctívago spike', artist: 'Rain + pad', state: 'playing' });
  }

  async stop() {
    this.sources.forEach((s) => s.stop());
    this.sources = [];
    await this.ctx?.close();
    this.ctx = null;
    await PlaybackNotificationManager.hide();
  }
}

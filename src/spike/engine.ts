import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AudioBufferSourceNode,
  type ConvolverNode,
  type GainNode,
} from 'react-native-audio-api';

// Spike graph, the same shape the desktop Mixer uses:
// rain → lowpass ┐
// pad  → gain    ┴→ mix → dry ─────────┬→ master → out
//                     mix → convolver ─┘
export class SpikeEngine {
  private ctx: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private reverbPath: { mix: GainNode; reverb: ConvolverNode; wet: GainNode; master: GainNode } | null = null;
  private reverbOn = true;

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
    reverb.connect(wet);
    this.reverbPath = { mix, reverb, wet, master };
    this.applyReverb();

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

  // Off = the convolver is cut out of the graph on both sides, so it costs no
  // CPU. Isolates whether screen-off clicks come from the reverb.
  setReverb(on: boolean) {
    if (on === this.reverbOn) return;
    this.reverbOn = on;
    this.applyReverb();
  }

  private applyReverb() {
    const p = this.reverbPath;
    if (!p) return;
    if (this.reverbOn) {
      p.mix.connect(p.reverb);
      p.wet.connect(p.master);
    } else {
      p.mix.disconnect(p.reverb);
      p.wet.disconnect(p.master);
    }
  }

  async stop() {
    this.sources.forEach((s) => s.stop());
    this.sources = [];
    await this.ctx?.close();
    this.ctx = null;
    this.reverbPath = null;
    await PlaybackNotificationManager.hide();
  }
}

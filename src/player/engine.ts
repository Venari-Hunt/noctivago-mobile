import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AudioBufferSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { audioUri, type SavedPreset } from './storage';

// Plays a phone preset like the desktop Mixer (docs/mobile.md, phase 3):
// each loop sound is its baked clip looping whole → its volume → master → out.
// The clips already carry filters, pan and reverb, so the phone only mixes.
// Random Interval and Scheduled sounds, Fluctuation, and the Sound Group /
// whole-mix filters arrive in phase 4.

const FADE_SECONDS = 0.4; // play/pause fade, like the Mixer's start ramp
const SLIDER_RAMP = 0.05;

type Voice = { gain: GainNode; source: AudioBufferSourceNode };
type Remote = 'play' | 'pause';

export class PlayerEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<number, Voice>();
  private masterVolume = 0.8;
  private subs: { remove(): void }[] = [];
  private title = '';
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;

  /** Lock-screen / notification buttons and audio interruptions (calls). */
  onRemote: (command: Remote) => void = () => {};

  get currentTime() {
    return this.ctx?.currentTime ?? 0;
  }

  /** Decodes every loop clip and wires the graph, silent and suspended. */
  async load(preset: SavedPreset, onProgress?: (done: number, total: number) => void) {
    await this.unload();
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.title = preset.name;
    this.masterVolume = preset.master;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    const loops = preset.sounds.map((s, i) => [s, i] as const).filter(([s]) => s.playMode === 'loop');
    let done = 0;
    // One at a time: each clip is decoded fully into memory, so decoding
    // them all at once could double the peak.
    for (const [sound, i] of loops) {
      const buffer = await ctx.decodeAudioData(audioUri(preset, i));
      if (this.ctx !== ctx) return; // unloaded while decoding
      const gain = ctx.createGain();
      gain.gain.value = sound.volume;
      gain.connect(master);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
      this.voices.set(i, { gain, source });
      onProgress?.(++done, loops.length);
    }
    await ctx.suspend();
    this.listen();
  }

  private listen() {
    this.subs.push(
      PlaybackNotificationManager.addEventListener('playbackNotificationPlay', () => this.onRemote('play')),
      PlaybackNotificationManager.addEventListener('playbackNotificationPause', () => this.onRemote('pause')),
    );
    AudioManager.observeAudioInterruptions(true);
    const sub = AudioManager.addSystemEventListener('interruption', (e) => {
      if (e.type === 'began') this.onRemote('pause');
      else if (e.shouldResume) this.onRemote('play');
    });
    if (sub) this.subs.push(sub);
  }

  async play() {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    await ctx.resume();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(this.masterVolume, now + FADE_SECONDS);
    // Showing the notification starts Android's media foreground service,
    // which is what keeps the app (and audio) alive with the screen off.
    await PlaybackNotificationManager.show({ title: this.title, artist: 'Noctívago', state: 'playing' });
    await PlaybackNotificationManager.enableControl('play', true);
    await PlaybackNotificationManager.enableControl('pause', true);
  }

  async pause() {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    // Suspending stops the audio thread, so a paused app costs no battery.
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      if (this.ctx === ctx) ctx.suspend().catch(() => {});
    }, FADE_SECONDS * 1000 + 50);
    await PlaybackNotificationManager.show({ title: this.title, artist: 'Noctívago', state: 'paused' });
  }

  setMasterVolume(volume: number, playing: boolean) {
    this.masterVolume = volume;
    if (playing) this.ramp(this.master, volume);
  }

  setSoundVolume(index: number, volume: number) {
    this.ramp(this.voices.get(index)?.gain ?? null, volume);
  }

  private ramp(node: GainNode | null, value: number) {
    if (!node || !this.ctx) return;
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(value, now + SLIDER_RAMP);
  }

  async unload() {
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    this.voices.forEach((v) => v.source.stop());
    this.voices.clear();
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    if (ctx) {
      await ctx.close();
      await PlaybackNotificationManager.hide();
    }
  }
}

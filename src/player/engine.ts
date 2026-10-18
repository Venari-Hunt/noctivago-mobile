import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AudioBufferSourceNode,
  type ConstantSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { fadePlan } from './domain/sleepTimer';
import { audioUri, type SavedPreset } from './storage';

// Plays a phone preset like the desktop Mixer (docs/mobile.md, phase 3):
// each loop sound is its baked clip looping whole → its volume → master →
// sleep fade → out.
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
  /** Sleep timer fade, after master so the master slider never cancels it. */
  private sleepGain: GainNode | null = null;
  /** Silent node whose end event marks the sleep timer's end. */
  private sleepMarker: ConstantSourceNode | null = null;
  private voices = new Map<number, Voice>();
  private masterVolume = 0.8;
  private subs: { remove(): void }[] = [];
  private title = '';
  /** Silent node whose end event suspends the context after a pause fade. */
  private suspendMarker: ConstantSourceNode | null = null;

  /** Lock-screen / notification buttons and audio interruptions (calls). */
  onRemote: (command: Remote) => void = () => {};
  /** The sleep timer's fade reached silence. */
  onSleepEnd: () => void = () => {};

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
    const sleepGain = ctx.createGain();
    master.connect(sleepGain).connect(ctx.destination);
    this.master = master;
    this.sleepGain = sleepGain;

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
    this.suspendMarker = dropMarker(this.suspendMarker);
    await ctx.resume();
    const now = ctx.currentTime;
    this.sleepGain?.gain.setValueAtTime(1, now); // master is silent here
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
    this.cancelSleepTimer();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    // Suspending stops the audio thread, so a paused app costs no battery.
    // Timed on the audio clock: a JS timer would stall with the screen off
    // and leave the thread running (measured: ~10% of a core, silent).
    dropMarker(this.suspendMarker);
    const marker = this.atAudioTime(now + FADE_SECONDS + 0.05, () => {
      if (this.suspendMarker !== marker) return;
      this.suspendMarker = null;
      ctx.suspend().catch(() => {});
    });
    this.suspendMarker = marker;
    await PlaybackNotificationManager.show({ title: this.title, artist: 'Noctívago', state: 'paused' });
  }

  // Fades to silence over the last seconds, timed on the audio clock (JS
  // timers stall with the screen off), then reports through onSleepEnd.
  setSleepTimer(seconds: number) {
    const { ctx, sleepGain } = this;
    if (!ctx || !sleepGain) return;
    this.cancelSleepTimer(true);
    const now = ctx.currentTime;
    const { fadeStart, end } = fadePlan(seconds);
    sleepGain.gain.setValueAtTime(1, now + fadeStart);
    sleepGain.gain.linearRampToValueAtTime(0, now + end);
    const marker = this.atAudioTime(now + end, () => {
      if (this.sleepMarker !== marker) return; // cancelled
      this.sleepMarker = null;
      this.onSleepEnd();
    });
    this.sleepMarker = marker;
  }

  // Calls back at an audio-clock time: a silent source that ends then. Its
  // end event reaches JS even with the screen off, unlike setTimeout.
  private atAudioTime(when: number, callback: () => void): ConstantSourceNode {
    const ctx = this.ctx!;
    const marker = ctx.createConstantSource();
    marker.offset.value = 0;
    marker.connect(ctx.destination);
    marker.onEnded = callback;
    marker.start(ctx.currentTime);
    marker.stop(when);
    return marker;
  }

  // restore: bring the volume back (the timer was turned off while playing).
  // Pausing leaves it where the fade got to; play() resets it while silent.
  cancelSleepTimer(restore = false) {
    this.sleepMarker = dropMarker(this.sleepMarker);
    const { ctx, sleepGain } = this;
    if (!ctx || !sleepGain) return;
    sleepGain.gain.cancelScheduledValues(ctx.currentTime);
    if (restore) this.ramp(sleepGain, 1);
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
    this.suspendMarker = dropMarker(this.suspendMarker);
    this.cancelSleepTimer();
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    this.voices.forEach((v) => v.source.stop());
    this.voices.clear();
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.sleepGain = null;
    if (ctx) {
      await ctx.close();
      await PlaybackNotificationManager.hide();
    }
  }
}

// Cancels an atAudioTime callback. Returns null for the caller's field.
function dropMarker(marker: ConstantSourceNode | null): null {
  if (!marker) return null;
  marker.onEnded = null;
  try {
    marker.stop();
  } catch {
    // already stopped
  }
  marker.disconnect();
  return null;
}

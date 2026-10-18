import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AudioBufferSourceNode,
  type ConstantSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { groupBusSpecs, groupIndexOf, shotSettings, soundFluctuation, wholeMixFadeIn, wholeMixSpec } from './domain/mixPlan';
import { syncShot } from './domain/shotPlan';
import { fadePlan } from './domain/sleepTimer';
import { MixBus, SoundDrift, type ParamDrift } from './mixGraph';
import { ShotVoice } from './shotVoice';
import { audioUri, type SavedPreset } from './storage';

// Plays a phone preset like the desktop Mixer (docs/mobile.md, phase 3):
// each sound's baked clip (looping whole, with its Fluctuation; or as
// Random Interval / Scheduled shots, shotVoice.ts) → its volume → its Sound
// Group bus → whole-mix bus → master → sleep fade → out (mixGraph.ts).
// The clips already carry their own filters, pan and all reverb, so the
// phone only mixes.

const FADE_SECONDS = 0.4; // play/pause fade, like the Mixer's start ramp
const SLIDER_RAMP = 0.05;
// Fluctuation is booked this far ahead on the audio clock, topped up every
// half of it (an audio-clock callback, so it keeps going with the screen off).
const DRIFT_HORIZON = 60;

type Voice = { gain: GainNode; source?: AudioBufferSourceNode; shots?: ShotVoice; drift?: SoundDrift };
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
  private buses: MixBus[] = [];
  private drifts: ParamDrift[] = [];
  private driftMarker: ConstantSourceNode | null = null;
  /** The first Play after loading fades in like the desktop's preset load. */
  private fadeIn = 0;

  /** Lock-screen / notification buttons and audio interruptions (calls). */
  onRemote: (command: Remote) => void = () => {};
  /** The sleep timer's fade reached silence. */
  onSleepEnd: () => void = () => {};

  get currentTime() {
    return this.ctx?.currentTime ?? 0;
  }

  /** Decodes every clip and wires the graph, silent and suspended. */
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
    const { manifest } = preset;
    this.fadeIn = wholeMixFadeIn(manifest);
    const wholeMix = new MixBus(ctx, wholeMixSpec(manifest), master, true);
    const groups = groupBusSpecs(manifest).map((spec) => (spec ? new MixBus(ctx, spec, wholeMix.input, true) : null));
    this.buses = [wholeMix, ...groups.filter((b): b is MixBus => !!b)];

    // One at a time: each clip is decoded fully into memory, so decoding
    // them all at once could double the peak.
    for (const [i, sound] of preset.sounds.entries()) {
      const buffer = await ctx.decodeAudioData(audioUri(preset, i));
      if (this.ctx !== ctx) return; // unloaded while decoding
      const gain = ctx.createGain();
      gain.gain.value = sound.volume;
      gain.connect(groups[groupIndexOf(manifest, i)]?.input ?? wholeMix.input);
      if (sound.playMode === 'loop') {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const drift = new SoundDrift(ctx, source.detune, soundFluctuation(manifest, i), gain);
        source.connect(drift.input);
        source.start();
        this.voices.set(i, { gain, source, drift });
      } else {
        const shots = new ShotVoice(ctx, buffer, gain, sound.playMode, shotSettings(manifest, i, sound.playMode));
        shots.sync = (voice, at) => this.syncGroup(voice, at);
        this.voices.set(i, { gain, shots });
      }
      onProgress?.(i + 1, preset.sounds.length);
    }
    this.drifts = [...this.buses, ...[...this.voices.values()].map((v) => v.drift)].flatMap((d) => d?.drifts ?? []);
    this.bookDrift();
    await ctx.suspend();
    this.listen();
  }

  // Books every Fluctuation walk ahead, then again before that runs out.
  private bookDrift() {
    const ctx = this.ctx;
    if (!ctx || this.drifts.length === 0) return;
    const now = ctx.currentTime;
    this.drifts.forEach((d) => d.book(now + DRIFT_HORIZON));
    const marker = this.atAudioTime(now + DRIFT_HORIZON / 2, () => {
      if (this.driftMarker !== marker) return;
      this.bookDrift();
    });
    this.driftMarker = marker;
  }

  // A sound in a sync group fires with the others (domain/shotPlan.ts).
  private syncGroup(voice: ShotVoice, at: number): number {
    const group = voice.syncGroup;
    if (!group) return at;
    const others = [...this.voices.values()]
      .map((v) => v.shots)
      .filter((s): s is ShotVoice => !!s && s !== voice && s.syncGroup === group);
    const plan = syncShot(at, others);
    others.forEach((s, k) => plan.fire[k] && s.plan(plan.at, true));
    return plan.at;
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
    // Random Interval fires on Play; Scheduled re-aims at the wall clock.
    this.voices.forEach((v) => v.shots?.restart());
    const now = ctx.currentTime;
    this.sleepGain?.gain.setValueAtTime(1, now); // master is silent here
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(this.masterVolume, now + Math.max(FADE_SECONDS, this.fadeIn));
    this.fadeIn = 0;
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
    this.driftMarker = dropMarker(this.driftMarker);
    this.drifts = [];
    this.voices.forEach((v) => {
      v.source?.stop();
      v.shots?.dispose();
      v.drift?.dispose();
    });
    this.voices.clear();
    this.buses.forEach((b) => b.dispose());
    this.buses = [];
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

import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AudioBufferSourceNode,
  type ConstantSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { playedVolume, soundFile } from './domain/mixEdit';
import { groupBusSpecs, groupIndexOf, loopFade, shotSettings, soundFluctuation, wholeMixFadeIn, wholeMixSpec } from './domain/mixPlan';
import { syncShot } from './domain/shotPlan';
import { fadePlan } from './domain/sleepTimer';
import { MixBus, SoundDrift, type ParamDrift } from './mixGraph';
import type { NightEntry } from './domain/nightLog';
import { recordNight } from './nightLog';
import { seamlessBuffer } from './seamless';
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
// Shot safety check and night log, on the audio clock too.
const WATCH_SECONDS = 60;
const WATCH_LOG_EVERY = 10; // a night log entry every 10 checks

type Voice = { gain: GainNode; source?: AudioBufferSourceNode; shots?: ShotVoice; drift?: SoundDrift };
type Routes = { wholeMix: MixBus; groups: (MixBus | null)[] };
type Remote = 'play' | 'pause';

export class PlayerEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Sleep timer fade, after master so the master slider never cancels it. */
  private sleepGain: GainNode | null = null;
  /** Silent node whose end event marks the sleep timer's end. */
  private sleepMarker: ConstantSourceNode | null = null;
  /** By the sound's audio file (mixEdit.soundFile), which stays put when a
   * sound before it is removed. */
  private voices = new Map<string, Voice>();
  private routes: Routes | null = null;
  private playing = false;
  /** How far ahead the Fluctuation walks are booked. */
  private driftUntil = 0;
  private masterVolume = 0.8;
  private subs: { remove(): void }[] = [];
  private title = '';
  /** Silent node whose end event suspends the context after a pause fade. */
  private suspendMarker: ConstantSourceNode | null = null;
  private buses: MixBus[] = [];
  private drifts: ParamDrift[] = [];
  private driftMarker: ConstantSourceNode | null = null;
  private watchMarker: ConstantSourceNode | null = null;
  private watchCount = 0;
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
    this.routes = { wholeMix, groups };

    // One at a time: each clip is decoded fully into memory, so decoding
    // them all at once could double the peak.
    for (const i of preset.sounds.keys()) {
      if (!(await this.addVoice(ctx, preset, i))) return; // unloaded while decoding
      onProgress?.(i + 1, preset.sounds.length);
    }
    this.drifts = [...this.buses, ...[...this.voices.values()].map((v) => v.drift)].flatMap((d) => d?.drifts ?? []);
    this.bookDrift();
    this.watch();
    this.logNight('load');
    await ctx.suspend();
    this.listen();
  }

  // Decodes sound `index` and wires it into its Sound Group (or the whole
  // mix). False when the engine was unloaded meanwhile.
  private async addVoice(ctx: AudioContext, preset: SavedPreset, index: number, fadeSeconds = 0): Promise<boolean> {
    const sound = preset.sounds[index];
    const { manifest } = preset;
    const buffer = await ctx.decodeAudioData(audioUri(preset, index));
    if (this.ctx !== ctx || !this.routes) return false;
    const gain = ctx.createGain();
    const volume = playedVolume(sound);
    if (fadeSeconds > 0) {
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeSeconds);
    } else gain.gain.value = volume;
    gain.connect(this.routes.groups[groupIndexOf(manifest, index)]?.input ?? this.routes.wholeMix.input);
    const key = soundFile(sound, index);
    if (sound.playMode === 'loop') {
      const source = ctx.createBufferSource();
      source.buffer = seamlessBuffer(ctx, buffer, loopFade(manifest, index, buffer.duration));
      source.loop = true;
      const drift = new SoundDrift(ctx, source.detune, soundFluctuation(manifest, index), gain);
      source.connect(drift.input);
      source.start();
      this.voices.set(key, { gain, source, drift });
    } else {
      const shots = new ShotVoice(ctx, buffer, gain, sound.playMode, shotSettings(manifest, index, sound.playMode));
      shots.sync = (voice, at) => this.syncGroup(voice, at);
      this.voices.set(key, { gain, shots });
    }
    return true;
  }

  /** Adds sound `index` of the edited mix while loaded, playing or not. */
  async addSound(preset: SavedPreset, index: number) {
    const ctx = this.ctx;
    if (!ctx || !(await this.addVoice(ctx, preset, index, this.playing ? FADE_SECONDS : 0))) return;
    const voice = this.voices.get(soundFile(preset.sounds[index], index));
    if (this.playing) voice?.shots?.restart();
    const drifts = voice?.drift?.drifts ?? [];
    if (drifts.length === 0) return;
    this.drifts.push(...drifts);
    if (this.driftMarker) drifts.forEach((d) => d.book(this.driftUntil));
    else this.bookDrift();
  }

  /** Fades a sound out of the mix and frees it. key: mixEdit.soundFile. */
  removeSound(key: string) {
    const voice = this.voices.get(key);
    const ctx = this.ctx;
    if (!voice || !ctx) return;
    this.voices.delete(key);
    const gone = new Set(voice.drift?.drifts ?? []);
    this.drifts = this.drifts.filter((d) => !gone.has(d));
    const free = () => {
      voice.source?.stop();
      voice.shots?.dispose();
      voice.drift?.dispose();
      voice.gain.disconnect();
    };
    if (!this.playing) return free();
    this.ramp(voice.gain, 0, FADE_SECONDS);
    // On the audio clock, like every timer here (the screen may be off).
    const marker = this.atAudioTime(ctx.currentTime + FADE_SECONDS + 0.05, () => {
      marker.disconnect();
      free();
    });
  }

  // Books every Fluctuation walk ahead, then again before that runs out.
  private bookDrift() {
    const ctx = this.ctx;
    if (!ctx || this.drifts.length === 0) return;
    const now = ctx.currentTime;
    this.driftUntil = now + DRIFT_HORIZON;
    this.drifts.forEach((d) => d.book(this.driftUntil));
    const marker = this.atAudioTime(now + DRIFT_HORIZON / 2, () => {
      if (this.driftMarker !== marker) return;
      this.bookDrift();
    });
    this.driftMarker = marker;
  }

  // Once a minute of playback: each shot books the next from its end event,
  // so one lost event would silence that sound for the night; re-book any
  // that dropped (ShotVoice.check). Every 10 minutes, a night log entry.
  private watch() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.watchCount > 0) {
      this.shotVoices().forEach(([i, s]) => s.check() && console.warn(`[shots] re-booked sound ${i}`));
      if (this.watchCount % WATCH_LOG_EVERY === 0) this.logNight('tick');
    }
    this.watchCount++;
    const marker = this.atAudioTime(ctx.currentTime + WATCH_SECONDS, () => {
      if (this.watchMarker !== marker) return;
      this.watch();
    });
    this.watchMarker = marker;
  }

  private shotVoices() {
    return [...this.voices.entries()].flatMap(([i, v]) => (v.shots ? [[i, v.shots] as const] : []));
  }

  private logNight(kind: NightEntry['kind']) {
    const shots = Object.fromEntries(this.shotVoices().map(([i, s]) => [i, [s.shots, s.rebooks] as [number, number]]));
    recordNight({ kind, audioSec: Math.round(this.currentTime), preset: this.title, shots });
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
    this.playing = true;
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
    this.logNight('play');
  }

  async pause() {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    this.cancelSleepTimer();
    this.playing = false;
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
    this.logNight('pause');
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
      this.logNight('sleep-end');
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

  /** key: the sound's audio file (mixEdit.soundFile). */
  setSoundVolume(key: string, volume: number) {
    this.ramp(this.voices.get(key)?.gain ?? null, volume);
  }

  /** The lock-screen title, shown from the next play or pause. */
  setTitle(title: string) {
    this.title = title;
  }

  private ramp(node: GainNode | null, value: number, seconds = SLIDER_RAMP) {
    if (!node || !this.ctx) return;
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(value, now + seconds);
  }

  async unload() {
    this.suspendMarker = dropMarker(this.suspendMarker);
    this.cancelSleepTimer();
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    this.driftMarker = dropMarker(this.driftMarker);
    this.watchMarker = dropMarker(this.watchMarker);
    this.watchCount = 0;
    this.drifts = [];
    this.voices.forEach((v) => {
      v.source?.stop();
      v.shots?.dispose();
      v.drift?.dispose();
    });
    this.voices.clear();
    this.buses.forEach((b) => b.dispose());
    this.buses = [];
    this.routes = null;
    this.playing = false;
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

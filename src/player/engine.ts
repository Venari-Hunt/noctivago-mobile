import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AudioBuffer,
  type AnalyserNode,
  type AudioBufferSourceNode,
  type ConstantSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { getSettings } from '../settings/store';
import { playedVolume, soundFile } from './domain/mixEdit';
import { groupBusSpecs, groupIndexOf, loopFade, shotSettings, soundFilterSpec, soundFluctuation, wholeMixFadeIn, wholeMixSpec } from './domain/mixPlan';
import { syncShot } from './domain/shotPlan';
import { fadePlan } from './domain/sleepTimer';
import { METER_SAMPLES, MixBus, SoundDrift, type ParamDrift } from './mixGraph';
import { peakOf } from './domain/levels';
import { trimFrames } from './domain/trimEdit';
import { trimBuffer } from './trim';
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
// A sound moving to another Sound Group dips out and back in this fast.
const REROUTE_DIP = 0.06;

type Voice = {
  gain: GainNode;
  buffer: AudioBuffer;
  /** The bus its gain feeds: its group's, or the whole mix's. */
  bus: MixBus;
  /** Its own drift or shot settings after its group's rules, as JSON. */
  own: string;
  source?: AudioBufferSourceNode;
  shots?: ShotVoice;
  drift?: SoundDrift;
  /** Its own filters (high-pass, low-pass, gain, echo) between its source and gain. */
  filterBus?: MixBus;
  /** Reads the sound's level (after its volume) on the way to its bus. */
  meter: AnalyserNode;
};
/** keys[g]: the spec group g's bus was built from, as JSON. */
type Routes = { wholeMix: MixBus; groups: (MixBus | null)[]; keys: string[] };
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
  private meterSamples = new Float32Array(METER_SAMPLES);
  private routes: Routes | null = null;
  private playing = false;
  /** How far ahead the Fluctuation walks are booked. */
  private driftUntil = 0;
  private masterVolume = 0.8;
  /** The Settings choice, read when the mix loads. */
  private softLimiter = true;
  private subs: { remove(): void }[] = [];
  private title = '';
  /** Silent node whose end event suspends the context after a pause fade. */
  private suspendMarker: ConstantSourceNode | null = null;
  private buses: MixBus[] = [];
  /** Group buses replaced by an edit, freed once no sound feeds them. */
  private retired: MixBus[] = [];
  /** The latest Sound Group edit, applied after the dip. */
  private grouped: SavedPreset | null = null;
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
    this.softLimiter = getSettings().softLimiter;
    const wholeMix = new MixBus(ctx, wholeMixSpec(manifest), master, true, this.softLimiter);
    this.buses = [wholeMix];
    this.addDrifts(wholeMix.drifts);
    this.routes = { wholeMix, groups: [], keys: [] };
    this.buildGroups(ctx, preset);

    // One at a time: each clip is decoded fully into memory, so decoding
    // them all at once could double the peak.
    for (const i of preset.sounds.keys()) {
      if (!(await this.addVoice(ctx, preset, i))) return; // unloaded while decoding
      onProgress?.(i + 1, preset.sounds.length);
    }
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
    const decoded = await ctx.decodeAudioData(audioUri(preset, index));
    // A trim set on the phone (or left by the PC) cuts the clip before anything else uses it.
    const buffer = trimBuffer(ctx, decoded, trimFrames(preset.manifest, index, decoded.sampleRate, decoded.length));
    if (this.ctx !== ctx || !this.routes) return false;
    const gain = ctx.createGain();
    const volume = playedVolume(sound);
    if (fadeSeconds > 0) {
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeSeconds);
    } else gain.gain.value = volume;
    const voice = this.wire(ctx, preset, index, gain, buffer);
    this.voices.set(soundFile(sound, index), voice);
    this.addDrifts(voice.drift?.drifts ?? []);
    return true;
  }

  // Where sound `index` goes and what it runs, after its group's rules.
  private routeOf(preset: SavedPreset, index: number): { bus: MixBus; own: string } {
    const routes = this.routes!;
    const { manifest } = preset;
    const mode = preset.sounds[index].playMode;
    const own = mode === 'loop' ? soundFluctuation(manifest, index) : shotSettings(manifest, index, mode);
    return { bus: routes.groups[groupIndexOf(manifest, index)] ?? routes.wholeMix, own: JSON.stringify(own) };
  }

  // Builds a sound's player into its gain (a looping source with its drift,
  // or Random Interval / Scheduled shots), and the gain into its bus. A
  // re-routed loop passes its running source, so it keeps its place.
  private wire(ctx: AudioContext, preset: SavedPreset, index: number, gain: GainNode, buffer: AudioBuffer, source?: AudioBufferSourceNode): Voice {
    const sound = preset.sounds[index];
    const { manifest } = preset;
    const { bus, own } = this.routeOf(preset, index);
    // The meter sits in the chain (a side branch ending nowhere silenced the mix once).
    const meter = ctx.createAnalyser();
    meter.fftSize = METER_SAMPLES;
    meter.smoothingTimeConstant = 0;
    gain.connect(meter).connect(bus.input);
    // Its own filters sit right after the source, so group routing never sees them.
    const spec = soundFilterSpec(manifest, index);
    const filterBus = spec ? new MixBus(ctx, spec, gain, false) : undefined;
    const feed = filterBus?.input ?? gain;
    if (sound.playMode !== 'loop') {
      const shots = new ShotVoice(ctx, buffer, feed, sound.playMode, shotSettings(manifest, index, sound.playMode));
      shots.sync = (voice, at) => this.syncGroup(voice, at);
      return { gain, buffer, bus, own, shots, filterBus, meter };
    }
    if (!source) {
      source = ctx.createBufferSource();
      source.buffer = seamlessBuffer(ctx, buffer, loopFade(manifest, index, buffer.duration));
      source.loop = true;
      source.start();
    }
    const drift = new SoundDrift(ctx, source.detune, soundFluctuation(manifest, index), feed);
    source.connect(drift.input);
    return { gain, buffer, bus, own, source, drift, filterBus, meter };
  }

  /** Adds sound `index` of the edited mix while loaded, playing or not. */
  async addSound(preset: SavedPreset, index: number) {
    const ctx = this.ctx;
    if (!ctx || !(await this.addVoice(ctx, preset, index, this.playing ? FADE_SECONDS : 0))) return;
    if (this.playing) this.voices.get(soundFile(preset.sounds[index], index))?.shots?.restart();
  }

  // A bus is reused while some group still asks for the same spec, so an
  // edit to one group leaves the others playing untouched.
  private buildGroups(ctx: AudioContext, preset: SavedPreset) {
    const routes = this.routes!;
    const specs = groupBusSpecs(preset.manifest);
    const keys = specs.map((spec) => (spec ? JSON.stringify(spec) : ''));
    const pool = routes.groups.flatMap((bus, g) => (bus ? [{ bus, key: routes.keys[g] }] : []));
    const groups = specs.map((spec, g) => {
      if (!spec) return null;
      const hit = pool.findIndex((p) => p.key === keys[g]);
      if (hit >= 0) return pool.splice(hit, 1)[0].bus;
      const bus = new MixBus(ctx, spec, routes.wholeMix.input, true, this.softLimiter);
      this.buses.push(bus);
      this.addDrifts(bus.drifts);
      return bus;
    });
    this.retired.push(...pool.map((p) => p.bus));
    this.routes = { wholeMix: routes.wholeMix, groups, keys };
  }

  /** Applies a Sound Group edit live: only the buses that changed are
   * rebuilt, and only the sounds whose route changed move, each with a
   * short dip so the switch doesn't click. */
  regroup(preset: SavedPreset) {
    const ctx = this.ctx;
    if (!ctx || !this.routes) return;
    this.grouped = preset;
    this.buildGroups(ctx, preset);
    if (!this.playing) return this.applyGroups();
    for (const [, voice] of this.movedVoices(preset)) this.ramp(voice.gain, 0, REROUTE_DIP);
    const marker = this.atAudioTime(ctx.currentTime + REROUTE_DIP + 0.02, () => {
      marker.disconnect();
      this.applyGroups();
    });
  }

  private movedVoices(preset: SavedPreset): [number, Voice][] {
    return [...preset.sounds.keys()].flatMap((i) => {
      const voice = this.voices.get(soundFile(preset.sounds[i], i));
      if (!voice) return [];
      const { bus, own } = this.routeOf(preset, i);
      return bus !== voice.bus || own !== voice.own ? [[i, voice] as [number, Voice]] : [];
    });
  }

  // Moves every sound to its latest route, then frees the buses left idle.
  private applyGroups() {
    const ctx = this.ctx;
    const preset = this.grouped;
    if (!ctx || !preset || !this.routes) return;
    for (const [i, voice] of this.movedVoices(preset)) {
      this.dropDrifts(voice.drift?.drifts ?? []);
      voice.drift?.dispose();
      voice.filterBus?.dispose();
      voice.shots?.dispose();
      voice.gain.disconnect();
      voice.meter.disconnect();
      voice.source?.disconnect();
      voice.source?.detune.cancelScheduledValues(ctx.currentTime);
      if (voice.source) voice.source.detune.value = 0;
      const next = this.wire(ctx, preset, i, voice.gain, voice.buffer, voice.source);
      this.voices.set(soundFile(preset.sounds[i], i), next);
      this.addDrifts(next.drift?.drifts ?? []);
      if (this.playing) next.shots?.restart();
      // Back up from the dip (also when paused meanwhile).
      this.ramp(voice.gain, playedVolume(preset.sounds[i]), REROUTE_DIP);
    }
    const fed = new Set([...this.voices.values()].map((v) => v.bus));
    const idle = this.retired.filter((b) => !fed.has(b));
    this.retired = this.retired.filter((b) => fed.has(b));
    idle.forEach((b) => {
      this.dropDrifts(b.drifts);
      b.dispose();
    });
    this.buses = this.buses.filter((b) => !idle.includes(b));
  }

  // Drift walks join the booking: right away once playback is set up (load
  // books everything at its end).
  private addDrifts(drifts: ParamDrift[]) {
    if (drifts.length === 0) return;
    this.drifts.push(...drifts);
    if (this.driftMarker) drifts.forEach((d) => d.book(this.driftUntil));
    else if (this.watchMarker) this.bookDrift();
  }

  private dropDrifts(drifts: ParamDrift[]) {
    const gone = new Set(drifts);
    this.drifts = this.drifts.filter((d) => !gone.has(d));
  }

  /** The highest peak that reached the limiter since the last call: the whole
   * mix and each Sound Group (0 for a group with no bus). 1 = 0 dBFS. */
  readLevels(): { mix: number; groups: number[] } {
    const routes = this.routes;
    if (!routes) return { mix: 0, groups: [] };
    return { mix: routes.wholeMix.peak(), groups: routes.groups.map((b) => b?.peak() ?? 0) };
  }

  /** Each sound's highest peak in the last ~85 ms, by key (mixEdit.soundFile); 1 = 0 dBFS. */
  readSoundLevels(): Map<string, number> {
    const levels = new Map<string, number>();
    this.voices.forEach((v, key) => {
      v.meter.getFloatTimeDomainData(this.meterSamples);
      levels.set(key, peakOf(this.meterSamples));
    });
    return levels;
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
      voice.filterBus?.dispose();
      voice.gain.disconnect();
      voice.meter.disconnect();
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

  /** One-off test shots still playing; the context suspends after the last. */
  private testing = 0;

  // The desktop's "Test fire" for Random Interval / Scheduled sounds. While
  // playing, an "on" sound skips its wait and fires now (the mix's chain,
  // groups included). Otherwise one shot plays on its own, at the sound's
  // volume times master, straight to the speaker (no group or whole-mix
  // chain), and a paused mix goes back to sleep after it.
  async testShot(key: string, volume: number, on: boolean) {
    const { ctx } = this;
    const shots = this.voices.get(key)?.shots;
    if (!ctx || !shots) return;
    if (this.playing && on) {
      shots.fireNow();
      return;
    }
    if (!this.playing) {
      this.suspendMarker = dropMarker(this.suspendMarker);
      await ctx.resume();
    }
    const out = ctx.createGain();
    out.gain.value = volume * this.masterVolume;
    out.connect(ctx.destination);
    this.testing++;
    shots.playOnce(out, () => {
      out.disconnect();
      this.testing--;
      if (!this.playing && this.testing === 0 && !this.suspendMarker) ctx.suspend().catch(() => {});
    });
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
  setSleepTimer(seconds: number, fadeSeconds?: number) {
    const { ctx, sleepGain } = this;
    if (!ctx || !sleepGain) return;
    this.cancelSleepTimer(true);
    const now = ctx.currentTime;
    const { fadeStart, end } = fadePlan(seconds, fadeSeconds);
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
      v.filterBus?.dispose();
    });
    this.voices.clear();
    this.buses.forEach((b) => b.dispose());
    this.buses = [];
    this.retired = [];
    this.grouped = null;
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

import {
  type AnalyserNode,
  type AudioContext,
  type GainNode,
  type AudioNode,
  type AudioParam,
  type ConstantSourceNode,
} from 'react-native-audio-api';
import { DriftPlan, panLoudnessCurve } from './domain/drift';
import { peakOf } from './domain/levels';
import { CLIP_RANGE, softClipCurve, straightClipCurve, type BusSpec } from './domain/mixPlan';

// The live parts of the mix that sit around the baked clips: Fluctuation
// (drift), Sound Group buses and the whole-mix bus. Everything is booked on
// the audio clock (screen off safe); the engine calls book() every so often.

// The desktop smooths each drift step a little (SoundSource.js: 0.12 s for a
// sound's volume and pitch, 0.02 s for pan and the buses); a walk with a
// slower glide than that just uses its own.
// About 85 ms of audio at 48 kHz: read every 100 ms, no peak slips between reads.
const METER_SAMPLES = 4096;
const SOUND_SMOOTHING = 0.12;
const BUS_SMOOTHING = 0.02;

/** One drifting AudioParam: the walk's targets, booked ahead. */
export class ParamDrift {
  constructor(
    private param: AudioParam,
    private plan: DriftPlan,
    private scale: number,
    private smoothing: number,
    startAt: number,
  ) {
    param.value = plan.start * scale;
    param.setValueAtTime(plan.start * scale, startAt);
  }

  book(until: number) {
    const tau = Math.max(this.plan.tau, this.smoothing);
    for (const step of this.plan.stepsUntil(until)) this.param.setTargetAtTime(step.target * this.scale, step.at, tau);
  }
}

let loudness: Float32Array | null = null;

// Stereo pan drift: a StereoPannerNode plus the desktop's loudness at each
// pan (domain/drift.ts, panLoudnessCurve). The pan value is a silent
// ConstantSource feeding both, so a drift glide moves one value.
export class PanStage {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** The pan value, -1..1. */
  readonly pan: AudioParam;
  private source: ConstantSourceNode;
  private nodes: AudioNode[];

  constructor(ctx: AudioContext) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;
    const level = ctx.createGain();
    level.gain.value = 0; // the shaper's output is the whole gain
    const shaper = ctx.createWaveShaper();
    shaper.curve = loudness ??= panLoudnessCurve();
    this.source = ctx.createConstantSource();
    this.source.offset.value = 0;
    this.pan = this.source.offset;
    this.source.connect(panner.pan);
    this.source.connect(shaper);
    shaper.connect(level.gain);
    panner.connect(level);
    this.source.start();
    this.input = panner;
    this.output = level;
    this.nodes = [panner, level, shaper, this.source];
  }

  dispose() {
    this.source.stop();
    this.nodes.forEach((n) => n.disconnect());
  }
}

/** A looping sound's drift stages, between its source and its volume. */
export class SoundDrift {
  readonly input: AudioNode;
  readonly drifts: ParamDrift[] = [];
  private nodes: AudioNode[] = [];
  private panStage: PanStage | null = null;

  constructor(ctx: AudioContext, detune: AudioParam, fluctuation: Record<string, unknown> | null, out: AudioNode) {
    const now = ctx.currentTime;
    const volume = DriftPlan.of('volume', fluctuation?.volume, now);
    const pitch = DriftPlan.of('pitch', fluctuation?.pitch, now);
    const pan = DriftPlan.of('pan', fluctuation?.pan, now);
    let next: AudioNode = out;
    if (pan) {
      this.panStage = new PanStage(ctx);
      this.panStage.output.connect(next);
      this.drifts.push(new ParamDrift(this.panStage.pan, pan, 1, BUS_SMOOTHING, now));
      next = this.panStage.input;
    }
    if (volume) {
      const gain = ctx.createGain();
      gain.connect(next);
      this.drifts.push(new ParamDrift(gain.gain, volume, 1, SOUND_SMOOTHING, now));
      this.nodes.push(gain);
      next = gain;
    }
    // Semitones to cents on the source's detune, like the desktop's
    // BufferSoundSource (tape-style: the loop also speeds up).
    if (pitch) this.drifts.push(new ParamDrift(detune, pitch, 100, SOUND_SMOOTHING, now));
    this.input = next;
  }

  dispose() {
    this.panStage?.dispose();
    this.nodes.forEach((n) => n.disconnect());
  }
}

let clipCurve: Float32Array | null = null;
// Passes everything through (the shaper is the same node with the limiter off,
// so the level meter reads the same way).
let straightCurve: Float32Array | null = null;

/** A Sound Group or the whole mix: filters → gain (+ echo) → drift →
 * ceiling → out. Builds nothing it doesn't need. */
export class MixBus {
  readonly input: GainNode;
  readonly drifts: ParamDrift[] = [];
  private nodes: AudioNode[] = [];
  private panStage: PanStage | null = null;
  private ctx: AudioContext;
  /** Reads the level just before the soft limiter (1/CLIP_RANGE of the signal), when there is one. */
  private meter: AnalyserNode | null = null;
  private samples = new Float32Array(METER_SAMPLES);

  constructor(ctx: AudioContext, spec: BusSpec | null, out: AudioNode, limit: boolean, soft = true) {
    this.ctx = ctx;
    const now = ctx.currentTime;
    this.input = ctx.createGain();
    this.nodes.push(this.input);
    let tail: AudioNode = out;
    if (limit) {
      const scale = ctx.createGain();
      scale.gain.value = 1 / CLIP_RANGE;
      const shaper = ctx.createWaveShaper();
      shaper.curve = soft ? (clipCurve ??= softClipCurve()) : (straightCurve ??= straightClipCurve());
      // The meter sits in the chain (an analyser passes its input through), not on
      // a side branch: a branch ending in a silent gain silenced the whole mix.
      const meter = ctx.createAnalyser();
      meter.fftSize = METER_SAMPLES;
      meter.smoothingTimeConstant = 0;
      scale.connect(meter).connect(shaper).connect(out);
      this.nodes.push(scale, meter, shaper);
      this.meter = meter;
      tail = scale;
    }
    if (!spec) {
      this.input.connect(tail);
      return;
    }
    const pan = DriftPlan.of('pan', spec.drift.pan, now);
    if (pan) {
      this.panStage = new PanStage(ctx);
      this.panStage.output.connect(tail);
      this.drifts.push(new ParamDrift(this.panStage.pan, pan, 1, BUS_SMOOTHING, now));
      tail = this.panStage.input;
    }
    const volume = DriftPlan.of('volume', spec.drift.volume, now);
    if (volume) {
      const gain = ctx.createGain();
      gain.connect(tail);
      this.drifts.push(new ParamDrift(gain.gain, volume, 1, BUS_SMOOTHING, now));
      this.nodes.push(gain);
      tail = gain;
    }
    let head: AudioNode = this.input;
    for (const stage of spec.stages) {
      const f = ctx.createBiquadFilter();
      f.type = stage.type as typeof f.type;
      f.frequency.value = stage.frequency;
      f.Q.value = stage.Q;
      f.gain.value = stage.gain;
      head.connect(f);
      this.nodes.push(f);
      head = f;
    }
    const gain = ctx.createGain();
    gain.gain.value = spec.gain;
    head.connect(gain);
    gain.connect(tail);
    this.nodes.push(gain);
    // Echo: repeat k is k delays after the dry signal, at decay^k.
    let from: AudioNode = gain;
    for (const level of spec.echo?.taps ?? []) {
      const delay = ctx.createDelay(spec.echo!.delaySeconds);
      delay.delayTime.value = spec.echo!.delaySeconds;
      const tap = ctx.createGain();
      tap.gain.value = level;
      from.connect(delay);
      delay.connect(tap);
      tap.connect(tail);
      this.nodes.push(delay, tap);
      from = delay;
    }
  }

  dispose() {
    this.panStage?.dispose();
    this.nodes.forEach((n) => n.disconnect());
  }

  /** The highest peak that reached the limiter in the last ~85 ms (1 = 0 dBFS,
   * above -1 dBFS the limiter bends it); 0 for a bus with no limiter. */
  peak(): number {
    if (!this.meter) return 0;
    this.meter.getFloatTimeDomainData(this.samples);
    return peakOf(this.samples) * CLIP_RANGE;
  }
}

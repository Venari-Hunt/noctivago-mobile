// Fluctuation ("drift") planned ahead on the audio clock. The desktop moves
// each value from a 60 ms JavaScript timer (src/shared/modulator.js), which
// stalls on a phone with the screen off. The walk itself is a series of
// targets, each approached exponentially with time constant `tau`, which is
// exactly what AudioParam.setTargetAtTime does natively. So the phone asks
// the desktop's own Modulator for its targets and change gaps, and books
// them on the audio clock a little ahead. Pure, so `npm test` can load it.
import { Modulator, normalizeFluctuationAxis } from '../../shared/modulator.js';
import { stereoPanMatrix } from '../../shared/pan.js';

export type DriftAxis = 'volume' | 'pitch' | 'pan';
export type DriftStep = { at: number; target: number };

// Neutral value and the range "fully random" roams, per axis (modulator.js).
const AXES: Record<DriftAxis, { neutral: number; min: number; max: number }> = {
  volume: { neutral: 1, min: 0, max: 1 },
  pitch: { neutral: 0, min: -6, max: 6 },
  pan: { neutral: 0, min: -1, max: 1 },
};

export class DriftPlan {
  private mod: Modulator;
  private nextAt: number;

  /** Returns null when the axis is off. `startAt` is the audio-clock time
   * the walk starts at its bias, like the desktop's Modulator.start(). */
  static of(axis: DriftAxis, config: unknown, startAt: number): DriftPlan | null {
    const a = AXES[axis];
    const normalized = normalizeFluctuationAxis(config, a.neutral);
    if (!normalized.enabled) return null;
    const mod = new Modulator({ onValue: () => {}, neutral: a.neutral, rangeMin: a.min, rangeMax: a.max });
    mod.configure(normalized);
    return new DriftPlan(mod, startAt);
  }

  private constructor(mod: Modulator, startAt: number) {
    this.mod = mod;
    this.nextAt = startAt + mod._nextIntervalMs() / 1000;
  }

  /** Where the walk starts and sits most of the time. */
  get start(): number {
    return this.mod.bias;
  }

  /** Glide time constant in seconds (0 = jump). */
  get tau(): number {
    return this.mod.tau;
  }

  /** The target changes from where the last call stopped up to `until`. */
  stepsUntil(until: number): DriftStep[] {
    const steps: DriftStep[] = [];
    while (this.nextAt <= until) {
      steps.push({ at: this.nextAt, target: this.mod._pickTarget() });
      this.nextAt += this.mod._nextIntervalMs() / 1000;
    }
    return steps;
  }
}

/** Loudness correction for a StereoPannerNode, as a curve over pan -1..1
 * (for a WaveShaper fed by the drifting pan value). The phone's audio
 * library has no channel splitter, so it can't build the desktop's pan
 * matrix (src/shared/pan.js); its StereoPannerNode moves the sound the same
 * way but keeps the total power of a stereo pair constant, while the
 * desktop's law lets it fall off toward the sides. This gain brings the
 * total back to the desktop's at every pan (uncorrelated channels; a mono
 * sound in both channels comes out the same). */
export function panLoudnessCurve(points = 1025): Float32Array {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const pan = (2 * i) / (points - 1) - 1;
    const desktopPower = stereoPanMatrix(pan)
      .flat()
      .reduce((sum, g) => sum + g * g, 0);
    curve[i] = Math.sqrt(desktopPower / 2); // the StereoPannerNode's total is always 2
  }
  return curve;
}

import type {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioNode,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';
import { randomGapSeconds, scheduleShotEnvelope, secondsUntilNextTrigger } from '../shared/shotRules.js';
import { planShot, type ShotConfig, type ShotMode } from './domain/shotPlan';

// One Random Interval or Scheduled sound: plays its baked clip as separate
// shots, each with its own pitch, speed, volume, pan and fades.
//
// Every shot is planned ahead on the audio clock (source.start(when)), and
// the next one is planned when the previous one ends: the end event reaches
// JavaScript with the screen off, while JavaScript timers (the desktop's
// setTimeout) stall. Random Interval waits a random gap after each shot and
// fires right away on Play; Scheduled waits for its wall-clock times.

const LEAD = 0.05; // seconds ahead of the audio clock a new shot starts

type Shot = {
  source: AudioBufferSourceNode;
  nodes: AudioNode[];
  start: number;
  end: number;
  chain: number;
};

export class ShotVoice {
  /** The latest planned shot: still waiting to start, or playing. */
  private current: Shot | null = null;
  private chain = 0;
  private live = new Set<Shot>();
  /** Set by the engine for sync groups; returns the time to fire at. */
  sync: ((voice: ShotVoice, at: number) => number) | null = null;

  constructor(
    private ctx: AudioContext,
    private buffer: AudioBuffer,
    private out: GainNode,
    readonly mode: ShotMode,
    readonly config: ShotConfig,
  ) {}

  get syncGroup(): string {
    return this.mode === 'scatter' && typeof this.config.syncGroup === 'string' ? this.config.syncGroup : '';
  }

  /** Start time of a shot that has not started yet. */
  get pendingAt(): number | null {
    const c = this.current;
    return c && c.start > this.ctx.currentTime ? c.start : null;
  }

  get busyUntil(): number {
    return this.current?.end ?? 0;
  }

  /** Called on load and on every Play: re-plans a shot that hasn't started
   * (the clock stood still while paused); one mid-play carries on. */
  restart() {
    if (this.current && this.pendingAt === null) return;
    const now = this.ctx.currentTime + LEAD;
    if (this.mode === 'scatter') {
      this.plan(now);
      return;
    }
    const wait = secondsUntilNextTrigger(this.config);
    if (wait === null) this.drop();
    else this.plan(now + wait);
  }

  /** silent: fired by another member of its sync group (no re-sync). */
  plan(at: number, silent = false) {
    if (!silent && this.sync) at = this.sync(this, at);
    this.drop();
    this.current = this.makeShot(at, ++this.chain);
  }

  private next(shot: Shot) {
    if (this.mode === 'scatter') {
      // From the planned end, so event delay never piles up into the gaps.
      this.plan(Math.max(shot.end + randomGapSeconds(this.config), this.ctx.currentTime + LEAD));
      return;
    }
    const wait = secondsUntilNextTrigger(this.config);
    if (wait !== null) this.plan(this.ctx.currentTime + wait);
  }

  // Cancels a shot that hasn't started; one that is playing finishes, but
  // no longer plans the next one.
  private drop() {
    const c = this.current;
    this.current = null;
    this.chain++;
    if (c && c.start > this.ctx.currentTime) this.release(c, true);
  }

  private makeShot(at: number, chain: number): Shot {
    const { ctx } = this;
    const plan = planShot(this.config, this.buffer.duration);
    const source = ctx.createBufferSource({ pitchCorrection: plan.pitchCorrection });
    source.buffer = this.buffer;
    source.playbackRate.value = plan.playbackRate;
    source.detune.value = plan.detuneCents;
    const gain = ctx.createGain();
    const nodes: AudioNode[] = [source, gain];
    source.connect(gain);
    let pan: StereoPannerNode | null = null;
    if (plan.pan !== 0) {
      pan = ctx.createStereoPanner();
      pan.pan.value = plan.pan;
      gain.connect(pan);
      nodes.push(pan);
    }
    (pan ?? gain).connect(this.out);
    scheduleShotEnvelope(gain.gain, plan.volume, at, plan.durationSeconds, plan.fadeInSeconds, plan.fadeOutSeconds);
    const shot: Shot = { source, nodes, start: at, end: at + plan.durationSeconds, chain };
    source.onEnded = () => {
      this.release(shot, false);
      if (shot.chain === this.chain) this.next(shot);
    };
    source.start(at);
    this.live.add(shot);
    return shot;
  }

  private release(shot: Shot, stop: boolean) {
    if (!this.live.delete(shot)) return;
    shot.source.onEnded = null;
    if (stop) {
      try {
        shot.source.stop();
      } catch {
        // already stopped
      }
    }
    shot.nodes.forEach((n) => n.disconnect());
  }

  dispose() {
    this.current = null;
    this.chain++;
    this.live.forEach((s) => this.release(s, true));
  }
}

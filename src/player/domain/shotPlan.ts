// Per-shot plan for Random Interval (scatter) and Scheduled sounds. The picks
// themselves are the desktop's (src/shared/shotRules.js); this file turns
// them into what the phone's buffer source needs. Pure, so `npm test` can
// load it.
import {
  fadeSeconds,
  randomPanPosition,
  randomPitchSemitones,
  randomSpeedFactor,
  randomVolumeScale,
} from '../../shared/shotRules.js';

export type ShotMode = 'scatter' | 'scheduled';
export type ShotConfig = Record<string, unknown>;

export type ShotPlan = {
  /** Plays at this rate; with pitchCorrection the rate keeps pitch. */
  playbackRate: number;
  detuneCents: number;
  /** Native time-stretch, only when the shot is pitched. */
  pitchCorrection: boolean;
  durationSeconds: number;
  volume: number;
  pan: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
};

// Matches the desktop Mixer: pitch moves without changing the shot's length
// (the desktop pre-stretches, the phone uses the library's native stretch),
// and speed is tape-style, so pitch rides along with it.
export function planShot(config: ShotConfig, clipSeconds: number): ShotPlan {
  const semitones = randomPitchSemitones(config);
  const speed = randomSpeedFactor(config);
  const pitched = Math.abs(semitones) > 0.01;
  const durationSeconds = clipSeconds / speed;
  const { fadeInSeconds, fadeOutSeconds } = fadeSeconds(config, durationSeconds);
  return {
    playbackRate: speed,
    // Without the stretch, playbackRate alone already shifts pitch with speed.
    detuneCents: pitched ? semitones * 100 + 1200 * Math.log2(speed) : 0,
    pitchCorrection: pitched,
    durationSeconds,
    volume: randomVolumeScale(config),
    pan: randomPanPosition(config),
    fadeInSeconds,
    fadeOutSeconds,
  };
}

export type SyncMember = { pendingAt: number | null; busyUntil: number };

// "Sync it up with" (scatter.syncGroup): on the desktop, when one member
// fires, every other member fires with it. The phone plans shots ahead on
// the audio clock, so the same rule runs at planning time: the group fires
// at the earliest planned shot, and every member not already firing then
// gets a shot there. A member mid-shot past that moment gets an extra,
// overlapping shot, like the desktop; one whose shot ends earlier plans its
// own next shot later and is pulled in then.
export function syncShot(at: number, others: SyncMember[]): { at: number; fire: boolean[] } {
  const earliest = Math.min(at, ...others.map((m) => m.pendingAt ?? Infinity));
  const fire = others.map((m) => (m.pendingAt !== null ? m.pendingAt > earliest : m.busyUntil > earliest));
  return { at: earliest, fire };
}

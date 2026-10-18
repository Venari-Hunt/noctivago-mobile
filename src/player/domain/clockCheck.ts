// Did the audio clock keep pace with the wall clock while the screen was off?
// JS timers get throttled in the background, so samples can be minutes apart;
// only the totals matter.

export type ClockSample = { wallMs: number; audioSec: number };

export type ClockReport = {
  wallMinutes: number;
  audioMinutes: number;
  /** 1 = audio ran the whole time. */
  ratio: number;
  /** Longest stretch between two samples where audio fell behind, in seconds. */
  worstStallSec: number;
};

export function clockReport(samples: ClockSample[]): ClockReport | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const wallSec = (last.wallMs - first.wallMs) / 1000;
  const audioSec = last.audioSec - first.audioSec;
  let worstStallSec = 0;
  for (let i = 1; i < samples.length; i++) {
    const wall = (samples[i].wallMs - samples[i - 1].wallMs) / 1000;
    const audio = samples[i].audioSec - samples[i - 1].audioSec;
    worstStallSec = Math.max(worstStallSec, wall - audio);
  }
  return {
    wallMinutes: wallSec / 60,
    audioMinutes: audioSec / 60,
    ratio: wallSec > 0 ? audioSec / wallSec : 1,
    worstStallSec,
  };
}

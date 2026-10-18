// Overnight test, morning summary. Reads the phone's night log (the
// `[nightlog]` lines the app prints to Android's log on start, saved with
// `adb logcat -d -s ReactNativeJS:V > night-logcat.txt`) and, if given, the
// PC poller's file (scripts/night-watch.mjs).
//
//   node scripts/night-report.mjs <night-logcat.txt> [night-watch.jsonl]

import { readFileSync } from 'node:fs';
import { clockReport } from '../src/player/domain/clockCheck.ts';
import { parseNightLog } from '../src/player/domain/nightLog.ts';

const [logcatPath, watchPath] = process.argv.slice(2);
if (!logcatPath) {
  console.error('usage: node scripts/night-report.mjs <night-logcat.txt> [night-watch.jsonl]');
  process.exit(1);
}

// Only the last printout: the app prints the whole log on every start.
const printed = readFileSync(logcatPath, 'utf8')
  .split('\n')
  .map((l) => /\[nightlog\] (\{.*\})/.exec(l)?.[1])
  .filter(Boolean)
  .join('\n');
const entries = parseNightLog(printed);
const lastLoad = entries.map((e) => e.kind).lastIndexOf('load');
const night = lastLoad >= 0 ? entries.slice(lastLoad) : entries;
if (night.length < 2) {
  console.log(`Not enough night log entries (${night.length}).`);
  process.exit(0);
}

const time = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const first = night[0];
const last = night[night.length - 1];
console.log(`Preset: ${first.preset}`);
console.log(`Log: ${time(first.wallMs)} to ${time(last.wallMs)}, ${night.length} entries; last entry "${last.kind}"`);

// Clock: one stretch per play..pause, since the audio clock stops when paused.
const stretches = [];
let run = [];
for (const e of night) {
  if (e.kind === 'play') run = [e];
  else if (run.length) run.push(e);
  if ((e.kind === 'pause' || e.kind === 'sleep-end') && run.length) {
    stretches.push(run);
    run = [];
  }
}
if (run.length) stretches.push(run);
for (const s of stretches) {
  const r = clockReport(s.map((e) => ({ wallMs: e.wallMs, audioSec: e.audioSec })));
  if (!r) continue;
  console.log(
    `Played ${time(s[0].wallMs)}-${time(s[s.length - 1].wallMs)}: audio ran ${(r.ratio * 100).toFixed(1)}% of the time` +
      ` (${r.audioMinutes.toFixed(0)} of ${r.wallMinutes.toFixed(0)} min), worst stall ${r.worstStallSec.toFixed(0)} s`,
  );
}

// Battery per hour, unplugged stretches only.
let drop = 0;
let hours = 0;
for (let i = 1; i < night.length; i++) {
  const a = night[i - 1];
  const b = night[i];
  if (a.battery == null || b.battery == null || a.charging || b.charging) continue;
  drop += (a.battery - b.battery) * 100;
  hours += (b.wallMs - a.wallMs) / 3.6e6;
}
if (hours > 0) console.log(`Battery: ${(drop / hours).toFixed(1)}% per hour over ${hours.toFixed(1)} h unplugged`);
if (first.jsHeapMb != null) console.log(`JS heap: ${first.jsHeapMb} MB at load, ${last.jsHeapMb} MB at the end`);

// Shot sounds: totals, and 10-minute stretches with no new shot.
const ticks = night.filter((e) => e.kind === 'tick');
for (const id of Object.keys(last.shots ?? {})) {
  const [shots, rebooks] = last.shots[id];
  let quiet = 0;
  for (let i = 1; i < ticks.length; i++) {
    if ((ticks[i].shots[id]?.[0] ?? 0) === (ticks[i - 1].shots[id]?.[0] ?? 0)) quiet++;
  }
  console.log(`Sound ${id}: ${shots} shots, ${rebooks} safety re-books, ${quiet} of ${Math.max(ticks.length - 1, 0)} ten-minute stretches with no shot`);
}

if (watchPath) {
  const polls = readFileSync(watchPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const ok = polls.filter((p) => p.ok && p.pid);
  console.log(`PC readings: ${ok.length} of ${polls.length} reached the app`);
  if (ok.length) {
    const pss = ok.map((p) => p.pssMb).filter((v) => v != null);
    const cpu = ok.map((p) => p.cpu).filter((v) => v != null);
    if (pss.length) console.log(`App memory: ${pss[0]} MB first, ${pss[pss.length - 1]} MB last, ${Math.max(...pss)} MB peak`);
    if (cpu.length) console.log(`App CPU: ${(cpu.reduce((a, b) => a + b, 0) / cpu.length).toFixed(1)}% of one core on average`);
    const pids = new Set(ok.map((p) => p.pid));
    if (pids.size > 1) console.log(`Warning: the app restarted during the night (${pids.size} different processes)`);
  }
}

// Overnight test, morning summary of the folder scripts/night-fetch.mjs
// filled: the app's night log (logcat.txt) and Android's own records.
//
//   node scripts/night-report.mjs <outDir>

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clockReport } from '../src/player/domain/clockCheck.ts';
import { parseNightLog } from '../src/player/domain/nightLog.ts';

const [dir] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node scripts/night-report.mjs <outDir>');
  process.exit(1);
}
const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '');

// Only the last printout: the app prints the whole log on every start.
const printed = read('logcat.txt')
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

// Android's records. CPU: time used by the process that played all night,
// over how long it lived (a process younger than the night means a restart).
const seconds = (t) => {
  const [days, rest] = t.includes('-') ? t.split('-') : ['0', t];
  return rest.split(':').reduce((acc, part) => acc * 60 + Number(part), 0) + Number(days) * 86400;
};
const ps = read('ps.txt').trim().split('\n')[1]?.trim().split(/\s+/);
if (ps) {
  const cpu = seconds(ps[1]);
  const alive = seconds(ps[2]);
  console.log(`App CPU: ${((cpu / alive) * 100).toFixed(1)}% of one core on average, process alive ${(alive / 3600).toFixed(1)} h`);
  const nightHours = (last.wallMs - first.wallMs) / 3.6e6;
  if (alive / 3600 < nightHours - 0.1) console.log('Warning: the process is younger than the night log; Android restarted the app');
} else console.log('App CPU: the app was not running in the morning');

// The phone's locale may write decimals with a comma ("1,0GB").
const pss = /TOTAL: [\d.,]+% \(([\d.,]+[KMG]B)-([\d.,]+[KMG]B)-([\d.,]+[KMG]B)/.exec(read('procstats.txt'));
console.log(pss ? `App memory (Android's record): ${pss[1]} min, ${pss[2]} average, ${pss[3]} peak` : 'App memory: no procstats total found (see procstats.txt)');

const exits = read('exit-info.txt')
  .split('\n')
  .filter((l) => /timestamp=|reason=|description=/.test(l))
  .slice(0, 6)
  .map((l) => l.trim());
if (exits.length) console.log(`Latest app exits (Android):\n  ${exits.join('\n  ')}`);

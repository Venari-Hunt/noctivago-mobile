// Overnight test, PC side: every 10 minutes, asks the phone (Wi-Fi adb) for
// battery, the app's memory and CPU, and whether it is still running, and
// appends one JSON line to a file. The phone's own night log is the main
// record (src/player/nightLog.ts); this adds memory, which the app can't
// measure itself. Wi-Fi adb can drop while the phone dozes, so a failed
// reading is recorded and the next one reconnects.
//
//   node scripts/night-watch.mjs <ip:port> <out.jsonl> [minutes=10]

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const ADB =
  process.env.ADB ??
  'C:/Users/jluca/AppData/Local/Microsoft/WinGet/Packages/Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe/platform-tools/adb.exe';
const PKG = 'io.github.venarihunt.noctivago';
const [address, out, minutes = '10'] = process.argv.slice(2);
if (!address || !out) {
  console.error('usage: node scripts/night-watch.mjs <ip:port> <out.jsonl> [minutes]');
  process.exit(1);
}

const adb = (...args) => execFileSync(ADB, ['-s', address, ...args], { encoding: 'utf8', timeout: 30_000 });

function reading() {
  try {
    execFileSync(ADB, ['connect', address], { encoding: 'utf8', timeout: 15_000 });
    const battery = adb('shell', 'dumpsys', 'battery');
    const level = Number(/level: (\d+)/.exec(battery)?.[1]);
    const plugged = /(AC|USB|Wireless) powered: true/.test(battery);
    const pid = adb('shell', 'pidof', PKG).trim() || null;
    let pssMb = null;
    let cpu = null;
    if (pid) {
      const mem = adb('shell', 'dumpsys', 'meminfo', PKG);
      const kb = Number(/TOTAL PSS:\s+(\d+)/.exec(mem)?.[1] ?? /^\s*TOTAL\s+(\d+)/m.exec(mem)?.[1]);
      pssMb = Number.isFinite(kb) ? Math.round(kb / 1024) : null;
      const top = adb('shell', 'top', '-b', '-n', '1', '-p', pid);
      const row = top.split('\n').find((l) => l.trim().startsWith(pid));
      cpu = row ? Number(row.trim().split(/\s+/)[8]) : null;
    }
    return { ok: true, level, plugged, pid, pssMb, cpu };
  } catch (e) {
    return { ok: false, error: String(e.message ?? e).split('\n')[0] };
  }
}

function tick() {
  const line = JSON.stringify({ wallMs: Date.now(), ...reading() });
  appendFileSync(out, line + '\n');
  console.log(line);
}

tick();
setInterval(tick, Number(minutes) * 60_000);

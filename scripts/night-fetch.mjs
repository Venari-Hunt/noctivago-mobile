// Overnight test, morning step: reads back everything the phone kept during
// the night, with nothing having run on the PC. Saves into <outDir>:
//   ps.txt         the app's CPU time and how long its process has lived
//   procstats.txt  Android's own memory record (PSS min/avg/max) for the app
//   exit-info.txt  Android's record of why the app's processes ended
//   battery.txt    Android's battery accounting for the app
//   logcat.txt     the app's night log: the app is restarted and prints it
// Then: node scripts/night-report.mjs <outDir>
//
//   node scripts/night-fetch.mjs <ip:port> <outDir> [hours=12]

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ADB =
  process.env.ADB ??
  'C:/Users/jluca/AppData/Local/Microsoft/WinGet/Packages/Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe/platform-tools/adb.exe';
const PKG = 'io.github.venarihunt.noctivago';
const [address, outDir, hours = '12'] = process.argv.slice(2);
if (!address || !outDir) {
  console.error('usage: node scripts/night-fetch.mjs <ip:port> <outDir> [hours]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const run = (...args) => execFileSync(ADB, args, { encoding: 'utf8', timeout: 60_000, maxBuffer: 64 << 20 });
const adb = (...args) => run('-s', address, ...args);
const save = (name, text) => {
  writeFileSync(join(outDir, name), text);
  console.log(`saved ${name} (${text.length} chars)`);
};

console.log(run('connect', address).trim());

// Before the restart: CPU time belongs to the process that played all night.
const pid = adb('shell', 'pidof', PKG).trim();
save('ps.txt', pid ? adb('shell', 'ps', '-o', 'PID,TIME+,ELAPSED,NAME', '-p', pid) : 'not running\n');
save('procstats.txt', adb('shell', 'dumpsys', 'procstats', '--hours', hours, PKG));
save('exit-info.txt', adb('shell', 'dumpsys', 'activity', 'exit-info', PKG));
save('battery.txt', adb('shell', 'dumpsys', 'batterystats', PKG));

// The app prints its saved night log on start.
adb('shell', 'am', 'force-stop', PKG);
adb('logcat', '-c');
adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
let logcat = '';
for (let i = 0; i < 15 && !/\[nightlog\] end \d+/.test(logcat); i++) {
  execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']);
  logcat = adb('logcat', '-d', '-s', 'ReactNativeJS:V');
}
save('logcat.txt', logcat);
if (!/\[nightlog\] end \d+/.test(logcat)) console.log('warning: no "[nightlog] end" line; the night log may be missing');

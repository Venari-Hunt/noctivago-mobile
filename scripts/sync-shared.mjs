// Copies the playback rules the phone shares with the desktop app from
// ../noctivago/src/shared/ into src/shared/. The copies are kept in this repo
// because EAS cloud builds only see this folder; test/shared.test.mjs fails
// when they drift from the desktop's. Run: node scripts/sync-shared.mjs
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SHARED_FILES = ['shotRules.js', 'modulator.js', 'groupDrift.js', 'pan.js', 'eqBands.js'];

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const name of SHARED_FILES) {
    copyFileSync(here(`../../noctivago/src/shared/${name}`), here(`../src/shared/${name}`));
    console.log(`copied ${name}`);
  }
}

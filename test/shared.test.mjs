import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SHARED_FILES } from '../scripts/sync-shared.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const desktop = here('../../noctivago/src/shared/');

test('shared rules match the desktop copy', { skip: !existsSync(desktop) && 'desktop repo not next to this one' }, () => {
  for (const name of SHARED_FILES) {
    const ours = readFileSync(here(`../src/shared/${name}`), 'utf8');
    const theirs = readFileSync(`${desktop}${name}`, 'utf8');
    assert.equal(ours, theirs, `${name} drifted: run node scripts/sync-shared.mjs`);
  }
});

// Renders an unzipped .ncvpreset (the phone file, or a community file's desktop part) through the desktop's own exportMix.
// Optional SKIP=name1,name2 leaves out sounds whose name starts with one of those.
// usage (from scripts/ab): node --import ./electron-stub.mjs render-desktop.mjs <presetDir> <seconds> <out.wav>
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const [dir, secs, out] = process.argv.slice(2)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const NCV = path.join(ROOT, 'noctivago/src/main/ffmpeg/exportMix.js')
const SIM = path.join(ROOT, 'noctivago-plugin-repos/noctivago-export/src/domain/simulate.js')
const CONST = path.join(ROOT, 'noctivago/src/shared/constants.js')
const { exportMix } = await import(pathToFileURL(NCV))
const { simulateEvents, applyGroupShotOverride } = await import(pathToFileURL(SIM))
const { applySoundOverride } = await import(pathToFileURL(CONST))
const p = JSON.parse(fs.readFileSync(path.join(dir, 'preset.json'), 'utf8'))
const durationSeconds = Number(secs)
const groupOf = new Map()
p.groups.forEach((g, gi) => g.soundIndexes.forEach((i) => groupOf.set(i, gi)))
const skip = (process.env.SKIP || "").split(",").filter(Boolean)
const sounds = p.sounds.map((s, i) => [s, i]).filter(([s]) => !skip.some((k) => s.name.startsWith(k))).map(([s, i]) => {
  const st = applySoundOverride(s.settings ?? {}, s.overrides) // a desktop-part preset keeps its per-preset edits here
  const gi = groupOf.get(i)
  const gf = gi == null ? null : p.groups[gi].filters?.fluctuation ?? null
  const entry = { ...st, durationSeconds: s.durationSeconds }
  const simEntry = gf ? { ...entry, scatter: applyGroupShotOverride(st.scatter, gf), schedule: applyGroupShotOverride(st.schedule, gf) } : entry
  return {
    soundId: 'x' + i, name: s.name, playMode: st.playMode ?? 'loop',
    loopStart: st.loopStart ?? 0, loopEnd: st.loopEnd ?? s.durationSeconds,
    filters: st.filters ?? {}, speedPitch: st.speedPitch ?? null, crossfadeSeconds: st.crossfadeSeconds ?? null,
    volume: s.volume ?? 0.7, groupId: gi == null ? null : 'g' + gi, fluctuation: st.fluctuation ?? null,
    events: simulateEvents({ entry: simEntry, durationSeconds }),
    inputPath: path.join(dir, 'audio', s.bundleName), cachedClipPath: null
  }
})
for (const s of sounds) if (s.playMode !== 'loop') console.log(s.events.length, 'shots', s.name)
const r = await exportMix({ sounds, durationSeconds, format: 'wav', wholeMixFilters: p.wholeMix, groups: p.groups.map((g, gi) => ({ id: 'g' + gi, filters: g.filters })), fadeInSeconds: 0, fadeOutSeconds: 0, outputPath: out, onProgress: () => {} })
console.log(JSON.stringify(r))

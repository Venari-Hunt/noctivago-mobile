// usage: node xcorr.mjs rec.f32 clip.f32 rate volume  -> estimated gain of clip inside rec
import fs from 'node:fs'
const rd = (f) => { const b = fs.readFileSync(f); return new Float32Array(b.buffer, b.byteOffset, b.length / 4) }
const [recF, clipF, rateS, volS] = process.argv.slice(2)
const rec = rd(recF), clip = rd(clipF), rate = Number(rateS), vol = Number(volS)
let N = 1; while (N < rec.length + clip.length) N <<= 1
function fft(re, im, inv) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n; len <<= 1) { const a = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a)
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0
      for (let j = 0; j < len / 2; j++) { const k = i + j + len / 2, tr = re[k] * cr - im[k] * ci, ti = re[k] * ci + im[k] * cr
        re[k] = re[i + j] - tr; im[k] = im[i + j] - ti; re[i + j] += tr; im[i + j] += ti; const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr } } }
}
// periodic clip extended to cover rec length for any offset: correlate rec with clip repeated twice
const L = clip.length
const ext = new Float64Array(N); for (let i = 0; i < Math.min(N, 2 * L + rec.length); i++) ext[i] = clip[i % L]
const r = new Float64Array(N); r.set(rec)
const ei = new Float64Array(N), ri = new Float64Array(N)
fft(ext, ei, false); fft(r, ri, false)
// corr[d] = sum rec[t]*ext[t+d]
const cr = new Float64Array(N), ci = new Float64Array(N)
for (let k = 0; k < N; k++) { cr[k] = ext[k] * r[k] + ei[k] * ri[k]; ci[k] = ei[k] * r[k] - ext[k] * ri[k] }
fft(cr, ci, true)
let best = 0, bd = 0; for (let d = 0; d < L; d++) { const v = cr[d] / N; if (v > best) { best = v; bd = d } }
let num = 0, den = 0, rr = 0; for (let t = 0; t < rec.length; t++) { const c = clip[(t + bd) % L]; num += rec[t] * c; den += c * c; rr += rec[t] * rec[t] }
const g = num / den
console.log(`offset ${(bd / rate).toFixed(2)} s  gain ${g.toFixed(4)} (${(20 * Math.log10(Math.abs(g))).toFixed(1)} dB)  preset volume ${vol} -> ratio ${(g / vol).toFixed(3)}  corr ${(num / Math.sqrt(den * rr)).toFixed(3)}`)

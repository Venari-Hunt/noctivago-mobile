import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  busSpec,
  echoTaps,
  groupBusSpecs,
  groupIndexOf,
  shotSettings,
  softClipCurve,
  soundFluctuation,
  wholeMixFadeIn,
  wholeMixSpec,
} from '../src/player/domain/mixPlan.ts';

const neutral = { highpassHz: 0, lowpassHz: 20000, gainDb: 0, echoDelayMs: 0, echoDecay: 0, reverbSizeMs: 0, reverbMix: 0, occlusion: 0, fluctuation: null, eq: [] };
const axis = { enabled: true, min: 0.5, max: 1, bias: 0.8, changeMinSeconds: 5, changeMaxSeconds: 15, transitionSeconds: 30 };

test('a neutral group or whole mix builds nothing (Beach\'s Gulls)', () => {
  const manifest = { sounds: [{}, {}], groups: [{ filters: neutral, soundIndexes: [1] }], wholeMix: null };
  assert.deepEqual(groupBusSpecs(manifest), [null]);
  assert.equal(wholeMixSpec(manifest), null);
  assert.equal(groupIndexOf(manifest, 1), 0);
  assert.equal(groupIndexOf(manifest, 0), -1);
});

test('filters become biquad stages in desktop order; no-op bands are skipped', () => {
  const spec = busSpec(
    {
      ...neutral,
      highpassHz: 120,
      lowpassHz: 8000,
      gainDb: -6,
      eq: [
        { type: 'peaking', freqHz: 500, q: 1, gainDb: 0 },
        { type: 'lowshelf', freqHz: 200, q: 0.7, gainDb: 3 },
        { type: 'lowpass', freqHz: 4000, q: 0.7, gainDb: 0, slope: 'steep' },
        { type: 'highshelf', freqHz: 6000, q: 0.7, gainDb: 4, muted: true },
      ],
    },
    {},
  );
  assert.deepEqual(
    spec.stages.map((s) => s.type),
    ['highpass', 'lowpass', 'lowshelf', 'lowpass', 'lowpass', 'lowpass', 'lowpass'],
  );
  assert.ok(Math.abs(spec.gain - 0.501) < 0.001);
  assert.equal(spec.echo, null);
});

test('echo becomes repeats at decay^k until 60 dB down', () => {
  const echo = echoTaps(0.3, 0.5);
  assert.equal(echo.delaySeconds, 0.3);
  assert.deepEqual(echo.taps.slice(0, 3), [0.5, 0.25, 0.125]);
  assert.ok(echo.taps.at(-1) >= 0.001 && echo.taps.length === 9);
  assert.equal(echoTaps(5, 0.9).taps.length, 16);
  assert.equal(echoTaps(5, 0.9).delaySeconds, 2);
  assert.equal(echoTaps(0, 0.5), null);
});

test('shared group drift runs on the bus and turns off the member\'s own', () => {
  const manifest = {
    sounds: [
      { settings: { playMode: 'loop', fluctuation: { volume: axis, pan: axis } } },
      { settings: { playMode: 'scatter', scatter: { minVolume: 0.2, maxVolume: 0.3 } } },
    ],
    groups: [{ filters: { ...neutral, fluctuation: { volume: axis } }, soundIndexes: [0, 1] }],
  };
  const [bus] = groupBusSpecs(manifest);
  assert.equal(bus.drift.volume.enabled, true);
  const own = soundFluctuation(manifest, 0);
  assert.equal(own.volume.enabled, false);
  assert.equal(own.pan.enabled, true);
  assert.equal(shotSettings(manifest, 1, 'scatter').minVolume, 0.2);
});

test('per-sound group drift goes to each member instead of the bus', () => {
  const manifest = {
    sounds: [
      { settings: { playMode: 'loop' } },
      { settings: { playMode: 'scatter', scatter: { minVolume: 0.2, maxVolume: 0.3 } } },
    ],
    groups: [{ filters: { ...neutral, fluctuation: { volume: { ...axis, perSound: true } } }, soundIndexes: [0, 1] }],
  };
  assert.deepEqual(groupBusSpecs(manifest), [null]);
  assert.equal(soundFluctuation(manifest, 0).volume.enabled, true);
  const shot = shotSettings(manifest, 1, 'scatter');
  assert.equal(shot.minVolume, 0.5);
  assert.equal(shot.maxVolume, 1);
});

test('the whole mix drifts in volume only and fades in on first play', () => {
  const manifest = { sounds: [{}], wholeMix: { ...neutral, fadeInSeconds: 5, fluctuation: { volume: axis, pan: axis } } };
  const spec = wholeMixSpec(manifest);
  assert.equal(spec.drift.volume.enabled, true);
  assert.equal(spec.drift.pan, undefined);
  assert.equal(wholeMixFadeIn(manifest), 5);
  assert.equal(wholeMixFadeIn({ sounds: [] }), 0);
});

test('the soft ceiling leaves normal levels alone and never passes 0.95', () => {
  const curve = softClipCurve(8193);
  const at = (x) => curve[Math.round(((x / 4 + 1) / 2) * 8192)];
  assert.ok(Math.abs(at(0.5) - 0.5) < 1e-6);
  assert.ok(Math.abs(at(-0.8) + 0.8) < 1e-3); // nearest curve point
  assert.ok(at(1.5) > 0.9 && at(1.5) < 0.95);
  assert.ok(Math.max(...curve) <= 0.95 && Math.min(...curve) >= -0.95);
});

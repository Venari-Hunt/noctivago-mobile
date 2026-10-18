# Changelog

## 0.0.3 — 2026-10-17

- Auto-update (EAS Update, channel `spike`): new JavaScript arrives over the air. The app checks on launch and whenever it comes back to the front, then restarts into the new version, but only while nothing is playing. Native changes (audio library patches, new native packages) still need a new APK; the `fingerprint` runtime version keeps an update from reaching an app whose native code does not match it.
- Version line on screen: version plus "built-in code" or the date of the update it is running.

## 0.0.2 — 2026-10-17

- Fix the clicks that started when the screen turned off: the Android audio output now uses the power-saving deep buffer (shared, media/music, full buffer capacity) instead of the low-latency exclusive path, which missed its 2.7 ms deadlines once the CPU slowed. Saved as `patches/react-native-audio-api+0.13.6.patch`, applied on every install by `patch-package`; the library is pinned to 0.13.6 so the patch always fits.
- Reverb On/Off button: cuts the convolver out of the graph, to tell whether any remaining clicks come from its CPU cost.
- `npm test` works on Node 24 again (test files passed as a glob).

## 0.0.1 — 2026-10-17

- Phase 0 spike: two looped Opus buffers (rain through a lowpass, a tonal pad that loops on an exact cycle so seam clicks are audible) into a convolver reverb, with Android's media foreground service via the playback notification.
- On screen: audio clock vs wall clock (did audio keep running while locked?), worst stall, battery drain per hour, interruption log.
- Test sounds: `rain.ogg` (20 s pink noise, lowpass 6 kHz), `pad.ogg` (8 s, 110/164.875/220/329.75 Hz), `room.wav` (2.5 s decaying noise impulse response), made with Noctívago's bundled ffmpeg.

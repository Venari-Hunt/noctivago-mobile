# Changelog

## 0.1.0 — 2026-10-17

- The player (phase 3, first part) replaces the spike screen.
  - **Import preset** opens the phone's file picker; pick a file saved by the PC's Export → "For phone". A regular desktop preset gets a message saying how to make the phone one. Imported presets stay on the phone; hold one to remove it.
  - **Player:** Play/Pause with a short fade, master volume, a volume slider per sound. Volumes are saved when you lift your finger.
  - **Lock screen / notification:** Play and Pause buttons work there; a phone call pauses, and playback resumes after it when Android allows.
  - Loop sounds play now. Random Interval and Scheduled sounds are listed but greyed out until phase 4, along with Fluctuation and Sound Group / whole-mix filters.
  - Pausing suspends the audio thread, so a paused preset costs no battery.
  - A small line under the player shows whether audio kept running and the battery drain per hour (from the spike).
- New native modules (`expo-file-system`, `@react-native-community/slider`), so this version needs a new APK.

## 0.0.4 — 2026-10-17

- Fix the screen-off gaps for real: measured over Wi-Fi debugging, 0.0.3 still lost ~32% of audio frames with the screen off (Android's track underrun counter), and 0 with Reverb Off. Cause: the reverb (ConvolverNode) handed each channel to a 4-thread pool and waited on it every 128 frames; Android throttles those normal-priority threads when the screen is off. The reverb now runs inline on the audio thread (added to `patches/react-native-audio-api+0.13.6.patch`).

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

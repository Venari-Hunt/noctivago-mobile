# Changelog

## 0.0.1 — 2026-10-17

- Phase 0 spike: two looped Opus buffers (rain through a lowpass, a tonal pad that loops on an exact cycle so seam clicks are audible) into a convolver reverb, with Android's media foreground service via the playback notification.
- On screen: audio clock vs wall clock (did audio keep running while locked?), worst stall, battery drain per hour, interruption log.
- Test sounds: `rain.ogg` (20 s pink noise, lowpass 6 kHz), `pad.ogg` (8 s, 110/164.875/220/329.75 Hz), `room.wav` (2.5 s decaying noise impulse response), made with Noctívago's bundled ffmpeg.

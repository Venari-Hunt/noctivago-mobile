# A/B against the desktop

Compares what the phone plays with what the desktop engine renders for the same preset. Tools in `scripts/ab/`. Needs `ffmpeg`, `adb`, scrcpy 2.0+ (`winget install Genymobile.scrcpy`), and the desktop repos next to this one (`../noctivago`, `../noctivago-plugin-repos/noctivago-export`).

**Use the exact `.ncvpreset` the phone imported.** Two exports of the same preset bake different clips; comparing against another export shows the loops as ~30 dB quiet (2026-10-18 false alarm).

1. Phone (ask the owner first): open the preset in the app, then record the app's own stream, which is captured before the phone's volume and Samsung's effects:
   `scrcpy -s <ip:port> --no-video --no-playback --no-window --audio-source=playback --audio-codec=flac --record=phone.flac --time-limit=210`
   and tap Play within the first seconds. (`--audio-source=output` records after the volume slider and is ~20 dB quieter.)
   **Absolute level unproven (2026-10-19):** a −38 dB RMS tone played by VLC came back +14.6 dB in this capture (same at media volume 3 and 5), and Noctívago's loops come back ~+3.8 dB over volume × master. Trust level *changes* within one capture; don't read a phone-vs-desktop level gap from it until a known tone through the app and through Chrome agree.
2. Desktop: unzip the same `.ncvpreset` into a folder, then from `scripts/ab`:
   `NCV_USERDATA=<temp dir> node --import ./electron-stub.mjs render-desktop.mjs <folder> 300 desktop.wav`
   (`SKIP=name1,name2` leaves sounds out, for isolating one.)
   A Community file holds two parts: the desktop part at the root and the phone copy under `phone/`. Both render with this script (per-preset overrides are applied), so rendering each checks the phone bake without the phone. Sounds the desktop part ships without audio (Freesound links) have to be removed from its `preset.json` first, with group `soundIndexes` renumbered.
3. `./compare.sh desktop.wav 10` and `./compare.sh phone.flac 10`: loudness, loudness range, peak, three bands, left/right, gaps, high-frequency crest (clicks). Shots are random, so expect ~1 dB differences; compare loops alone (`SKIP` the shots) when shots dominate, as thunder does.
4. Per loop, its level inside a recording: convert both to mono 4 kHz float (`ffmpeg -i X -af "aresample=4000,pan=mono|c0=0.5*c0+0.5*c1" -f f32le X.f32`), then `node xcorr.mjs rec.f32 clip.f32 4000 <preset volume>`. `ratio` should be ~1, or the average of its volume drift.

Baseline, Beach, 2026-10-18 (mobile 0.5.0): phone −35.0 LUFS / desktop −35.3, LRA 7.4 / 7.5, bands and left/right within 0.7 dB; loop ratios phone 0.80 / 0.83 / 0.71, desktop 0.75 / 0.95 / 0.70.

Rain Inside, Community file of 2026-10-19 (desktop 0.1.271), desktop part vs phone copy, both through the desktop engine, loops only: −45.4 / −46.3 LUFS, LRA 3.8 / 4.1, bands within 1.2 dB, same Opus bitrate (~100 kbps), every phone loop wraps without a gap or level jump. The phone copy is faithful; the owner's "phone sounds unnatural" report is not in the file.

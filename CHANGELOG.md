# Changelog

## 0.12.0 — 2026-10-19

- **Community tab** (phone Mixer, phase 10). Browse the presets people shared from the PC app: search, Newest or Popular, Load more. Each shows its author, sound count, size and downloads. Tap one, confirm, and it downloads into **Mixes** and opens in the player.
- It plays the preset exactly as the PC does: since PC version 0.1.270, a shared preset carries a ready-to-play phone copy with every effect applied. Presets shared before that say to ask the author to share again.
- The whole file downloads (the PC's copy too, Beach is about 46 MB), but only the phone copy is kept.
- Opening a community file from another app ("Open with") works the same way.
- JavaScript only: arrives over the air on 0.6.0.

## 0.11.0 — 2026-10-19

- **Browse Freesound** (phone Mixer, phase 10). In **Sounds**, tap **Browse Freesound**, type what you want (rain, birds, fireplace…) and search. Each result shows its length, author and license. Tap one to listen, tap **Add** to keep it in your sounds; **Load more** brings the next 15. Hold a result to open its page on freesound.org.
- Added sounds are Freesound's 128 kbps MP3 preview, the same file the PC app uses, and get the sound's first five tags. Their row says who made them, and a shared mix keeps the author and license, so the PC credits them too.
- JavaScript only: arrives over the air on 0.6.0.

## 0.10.1 — 2026-10-19

- **From a link** now works with sites that refuse unnamed downloaders, like Wikimedia Commons (they answered 403): downloads say they come from Noctívago.
- JavaScript only: arrives over the air on 0.6.0.

## 0.10.0 — 2026-10-19

- **Add a sound from a link** (phone Mixer, phase 10). In **Sounds**, tap **From a link** and paste a direct link to an audio file (MP3, WAV, FLAC, OGG, Opus, M4A). The file downloads into your library like a picked one; its name comes from the server or the link. "https://" can be left out.
- Links from YouTube, SoundCloud, Bandcamp and other video or music sites say to use the PC app: the PC fetches those with yt-dlp, which doesn't run on a phone. Files over 200 MB are refused.
- JavaScript only: arrives over the air on 0.6.0.

## 0.9.0 — 2026-10-19

- **Sound Groups** (phone Mixer, phase 9). In a mix, under **Sound Groups**, tap **+ New group**, name it, and tap the sounds to put in it. Or hold a sound's name: **Add to "<group>"**, **Leave "<group>"**, or **New group with this sound…**. A sound is in one group at a time, like on the PC; its row shows the group's name.
- Tap a group to edit what its sounds share: **High-pass**, **Low-pass**, **Gain**, **Echo delay** and **Echo decay** (the PC's Remix ranges; the frequency sliders move evenly per octave), and **Volume**, **Pan** and **Pitch drift**, each Off, **Together** (the whole group moves as one) or **Each sound** (every sound wanders on its own in that range), with its lowest and highest point. **Rename** and **Delete** are at the top; deleting a group leaves its sounds in the mix.
- Changes play right away, also while the mix plays: only the group you changed is rebuilt, and its sounds dip out for a moment (about 0.1 s) instead of clicking. The other sounds don't move.
- Groups from a PC preset can be edited the same way. Their EQ stays as the PC set it.
- A shared mix keeps its groups on the PC. Empty groups stay in the phone mix (so you can fill them later) and are left out when sharing, as the PC's export does.
- JavaScript only: arrives over the air on 0.6.0.

## 0.8.0 — 2026-10-19

- **Seamless loops for your own sounds** (phone Mixer, phase 8). A sound added on the phone no longer jumps or clicks where it wraps around: like the desktop's "Prepare seamless looping", the end is blended into the start with a 0.2 s equal-power crossfade, and the loop starts mid-clip so the wrap itself is continuous. The loop gets 0.2 s shorter.
- Applies to every phone-added sound in a mix and to the Sounds tab preview. It happens when the mix loads (no new files, no conversion). Presets exported from the PC are already seamless and play as before.
- A shared mix sounds the same on the PC: the PC gives these sounds the same 0.2 s crossfade on import.
- JavaScript only: arrives over the air on 0.6.0.

## 0.7.0 — 2026-10-18

- **Build your own mixes** (phone Mixer, phase 7). In Mixes, **New mix** starts an empty mix and opens it. In a mix, **Add sounds** picks sounds from your library (search, several at once), or **From files on this phone** adds new ones to the library and picks them in one go. A sound added while the mix plays fades in; no reload.
- Each sound in a mix plays on a loop, with its own volume slider. Hold a sound's name to **turn it off** (it stays in the mix, silent, and keeps its volume) or **remove** it.
- Hold a mix in Mixes, or tap **⋯** in the mix: **Rename**, **Save a copy**, **Share**, **Delete**. Every change is saved as you make it.
- **Share** sends the mix as a `.ncvpreset` (WhatsApp, Drive, email…). It imports on another phone and on the PC (Presets → **Import preset…**), with your volumes. Sounds in AAC, AIFF or MP4 audio share, but the PC skips their audio (it imports MP3, WAV, OGG, FLAC, M4A and Opus).
- Sounds added to a mix are copied into it, so deleting a sound from the library leaves your mixes whole. Imported presets can be edited the same way (add, turn off, remove).
- A mix whose sounds would take over ~300 MB of memory while playing says so.
- A phone-added sound loops plainly (no crossfade at the seam yet; that is phase 8).
- JavaScript only: arrives over the air on 0.6.0.

## 0.6.0 — 2026-10-18

- **Your own sounds** (phone Mixer, phase 6): the home screen has two tabs, **Mixes** (your presets) and **Sounds** (your library). **Add sounds** opens the file picker and takes several files at once (MP3, WAV, FLAC, OGG, Opus, M4A, AAC, AIFF). You can also share audio files to Noctívago from another app, or pick it in "Open with"; one file or several. Each file is copied into the app, so moving or deleting the original doesn't break it.
- Sounds are named after their file (accents kept). When Android hands over only an internal id ("Open with" from the media store), the sound is called "Sound"; hold it to rename.
- Library: tap a sound to hear it on a loop, tap again to stop. Hold it to rename, edit tags or delete. Search finds names and tags (ignores case and accents); sort by newest, name or length. Sounds over 10 minutes are marked, since they use a lot of memory while playing.
- Building a mix from your sounds comes next (phase 7).
- Native change (Android share and "Open with" for audio): needs the new APK, not an over-the-air update.
- Tested on the owner's phone: picker with several files, Share, "Open with" (sounds and presets), preview, rename, tags, search, sort, delete, and the library surviving an app restart.
- CI on GitHub: typecheck and tests on every pull request, with the desktop repo checked out alongside so the shared-rules check runs too.

## 0.5.0 — 2026-10-18

- **First public release** on GitHub Releases (preview APK). README, and the license is now Apache-2.0 like the desktop app (it was Expo's template file).
- **A/B against the desktop** (Beach, 5 minutes, phone audio recorded from the app's own stream): integrated loudness −35.0 vs −35.3 LUFS, loudness range 7.4 vs 7.5 LU, bass/mid/treble and left/right levels within 0.7 dB, no gaps or clicks. Each loop's level inside the phone recording matches its preset volume times its drift, as on the desktop. Tools and steps for the next one: `scripts/ab/`, `docs/ab-test.md`.

- **Less memory:** the audio library copied each decoded clip whenever a player started it, so every loop sound sat in memory twice and every Random Interval / Scheduled shot made a fresh full copy. The phone now shares one copy. Shots with pitch correction still get a short-lived copy (the library needs a silent tail on those).
- Measured on the owner's phone (Beach, all 18 sounds): 367 MB loaded and paused (the export's ~244 MB of audio plus the app itself), ~446 MB playing (peaks 483 MB, falls back as pitched-shot copies are freed; no growth over 5 minutes), 100% audio uptime. Before: 514 MB with only its loop sounds decoded.
- Native change (patch in `patches/react-native-audio-api+0.13.6.patch`): needs the new APK, not an over-the-air update.

## 0.4.3 — 2026-10-18

- **Night log** for unattended overnight tests: every 10 minutes of playback (and on load, play, pause and sleep timer end) the app saves one line to its storage: time, audio clock, battery, charging, JavaScript memory, and per Random Interval / Scheduled sound the shots played and safety re-books. On start the app prints the saved log to Android's log, so it can be read back without anyone watching. Steps: `docs/night-test.md`.
- PC tools (not in the app): `scripts/night-fetch.mjs` reads it all back in the morning, the night log plus Android's own records (memory history, the app's CPU time and process age, why the app last stopped, battery accounting), so nothing has to run on the PC overnight; `scripts/night-report.mjs` summarizes them.
- The 10-minute `[shots]` log line from 0.4.2 is replaced by the night log entry.
- JavaScript only: arrives over the air on 0.2.0.

## 0.4.2 — 2026-10-18

- **Safety check for Random Interval and Scheduled sounds:** each shot books the next one when it ends, so one lost "shot ended" event used to silence that sound for the rest of the night. Once a minute (timed on the audio clock, so it runs with the screen off) the player checks that every shot sound has its next shot booked, and re-books any that dropped. A shot counts as lost 5 seconds after its planned end.
- For the overnight test: every 10 minutes the app writes `[shots] t=… shots/rebooks` to Android's log (per sound: shots played, safety re-books); a re-book also logs `[shots] re-booked sound N`.
- JavaScript only: arrives over the air on 0.2.0.

## 0.4.1 — 2026-10-18

- Fix: a preset whose sound file names had an accent or a special character (é, ç, a wide "｜" bar) failed to import with "missing the audio for…". Desktop exports before v0.1.269 wrote those names without the zip's UTF-8 flag, so they were read as Latin-1; the phone now reads them back as UTF-8. Desktop v0.1.269 writes the flag.
- JavaScript only: arrives over the air on 0.2.0.

## 0.4.0 — 2026-10-18

- **Fluctuation plays** (phase 4, second part): a looping sound's slow volume, pitch and pan drift, with the desktop's own random walk (`src/shared/modulator.js`). The walk's targets are booked a minute ahead on the audio clock and topped up every 30 seconds, so drift keeps moving with the screen off.
- **Sound Groups and the whole mix:** their highpass, lowpass, EQ (steep slopes included), gain and echo play live, plus a group's shared volume and pan drift and the whole mix's volume drift and fade-in. A group's "each sound on its own" drift goes to its members, as on the desktop (`src/shared/groupDrift.js`). Groups and filters that change nothing build no audio nodes.
- The whole mix and every active group end in a soft ceiling standing in for the desktop's limiter (the phone's audio library has no compressor): untouched below -1 dBFS, never above 0.95.
- Echo plays as fixed repeats (each one delay later, at decay^k, until 60 dB down, at most 16): the audio library can't run the desktop's feedback loop.
- Pan drift uses Android's stereo panner plus a loudness correction, so the level at each pan matches the desktop's pan law; the left/right balance of a wide stereo sound differs slightly.
- JavaScript only: arrives over the air on 0.2.0.

## 0.3.0 — 2026-10-18

- **Random Interval and Scheduled sounds play** (phase 4, first part). Each shot gets the desktop's own random pitch, speed, volume, pan and fades; Random Interval waits its random gap after each shot and fires right away on Play, Scheduled plays at its clock times. "Sync it up with" groups fire together.
- Shots are timed on the audio clock, planned one ahead, so they keep firing with the screen off (JavaScript timers stall then).
- Pitch keeps the shot's length like the desktop, using the audio library's built-in time-stretch, only on shots that are actually pitched. Speed is tape-style (pitch rides along), as on the desktop.
- Per-shot pan uses Android's standard stereo panner, so a hard-panned shot is a little louder than on the desktop (up to +3 dB for a mono sound).
- The shot rules are the desktop's own `src/shared/shotRules.js` and `modulator.js`, copied into `src/shared/` by `node scripts/sync-shared.mjs`; `npm test` fails if the copies drift.
- JavaScript only: arrives over the air on 0.2.0.

## 0.2.0 — 2026-10-18

- **Open with / Share:** tap a `.ncvpreset` file in WhatsApp, Gmail, Drive or a file manager and choose Noctívago, or use Share → Noctívago. The preset is imported and opens straight in the player. Android matches these files by type (`application/octet-stream`, zip) since `.ncvpreset` has no registered type, so Noctívago also appears for other unknown files; picking one shows "That file isn't a Noctívago preset."
- Importing a preset with the same name as a saved one replaces it (re-sending an updated export, or tapping the file twice, no longer makes a copy).
- Receiving shares uses `expo-sharing` (Expo marks it experimental); "Open with" uses Android intent filters in `app.json`. New native config, so this version needs a new APK.

## 0.1.2 — 2026-10-18

- Fix: pausing with the screen off (lock-screen button, sleep timer ending) left the audio thread running, silent, at ~10% of one core until the screen came back on. The suspend after the fade used a JavaScript timer, which stalls while the screen is off; it now runs on the audio clock like the sleep timer.
- The chosen sleep timer chip lights up while it runs.
- Measured on the owner's phone (Beach, 18 sounds): the 15-minute timer paused within a few seconds of on time with the screen off; screen-off playback ~10% of one core, 0 missing frames; 514 MB of memory with only its loop sounds decoded (about twice the desktop export's estimate; follow-up).

## 0.1.1 — 2026-10-18

- Sleep timer on the player: Off, 15m, 30m, 45m, 1h, 1h 30m, 2h (the desktop's choices), with a countdown. The sound fades out over the last 30 seconds, then playback pauses. Picking a time while paused starts playing; pausing turns the timer off.
- The fade and the stop are timed on the audio clock, not a JavaScript timer, because JavaScript timers stall while the screen is off.
- JavaScript only: arrives over the air on 0.1.0 (same native fingerprint).

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

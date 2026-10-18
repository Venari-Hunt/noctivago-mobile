# Overnight test

Measures a whole night of playback with nobody watching and the PC off. Everything is kept on the phone and read back in the morning:

1. **The app's night log** (`src/player/nightLog.ts`): every 10 minutes of playback, plus on load, play, pause and sleep timer end, one saved line: wall time, audio clock, battery, charging, JS heap, and per shot sound the shots played and safety re-books. Kept in app storage (newest 1000 lines); the app prints it to Android's log on start.
2. **Android's own records**, kept by the phone anyway: memory history (`dumpsys procstats`: PSS min/avg/max), the app process's CPU time and age (`ps`), why app processes ended (`dumpsys activity exit-info`), battery accounting (`dumpsys batterystats`).

## Evening (owner alone, no adb)

1. Open Noctívago and wait a few seconds on the preset list: it reloads itself into the latest update. The bottom line should read v0.4.3 or later.
2. Unplug the phone, open the preset, set the sleep timer if wanted, press Play, lock the screen.

## Morning (ask before touching the phone)

1. Owner: unlock the phone, open Wireless debugging, give the IP:port. Don't close or reopen Noctívago first (its CPU time is read from the night's process).
2. `node scripts/night-fetch.mjs <ip:port> <dir>`: saves Android's records, then restarts the app and saves its night log.
3. `node --no-warnings scripts/night-report.mjs <dir>`.

What the report says: how long audio ran against the wall clock (and the worst stall), battery per hour unplugged, JS heap start and end, per shot sound its shots, re-books and 10-minute stretches with no shot (a sound with long gaps can have some honestly), the app's average CPU and whether Android restarted it, memory min/average/peak, and the latest app exits with their reasons. `battery.txt` holds Android's per-app battery estimate, read by hand.

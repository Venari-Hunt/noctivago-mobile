# Overnight test

Measures a whole night of playback with nobody watching. Two records:

1. **The phone's night log** (main record, needs nothing running): every 10 minutes of playback, plus on load, play, pause and sleep timer end, the app saves one line: wall time, audio clock, battery, charging, JS heap, and per shot sound the shots played and safety re-books (`src/player/nightLog.ts`). Kept in app storage, newest 1000 lines.
2. **PC readings** (extra, best effort): `scripts/night-watch.mjs` asks the phone over Wi-Fi adb every 10 minutes for battery, the app's memory (PSS) and CPU, and whether the app is still the same process. Wi-Fi adb can drop while the phone dozes (VPN on), so gaps are expected; the PC must stay on.

## Evening (owner present; ask before touching the phone)

1. Owner: unplug the phone, open Noctívago (loads the latest update), open the preset, set the sleep timer if wanted, press Play, lock the screen.
2. `adb connect <ip:port>` (the port is on the phone's Wireless debugging screen).
3. Start the PC readings in the background: `node scripts/night-watch.mjs <ip:port> <scratchpad>/night-watch.jsonl`.

## Morning

1. Owner: unlock the phone (do not close Noctívago first).
2. `adb connect <ip:port>`, then stop the PC readings (by the PID started in the evening).
3. `adb shell am force-stop io.github.venarihunt.noctivago`, `adb logcat -c`, `adb shell monkey -p io.github.venarihunt.noctivago 1`: the restarted app prints its saved log.
4. `adb logcat -d -s ReactNativeJS:V > <scratchpad>/night-logcat.txt`; check it ends with `[nightlog] end N`.
5. `node scripts/night-report.mjs <scratchpad>/night-logcat.txt <scratchpad>/night-watch.jsonl`.

What the report says: how long audio ran against the wall clock (and the worst stall), battery per hour unplugged, JS heap start and end, per shot sound its shots, re-books and 10-minute stretches with no shot (a sound with long gaps can have some honestly), and from the PC: memory first/last/peak, average CPU, and whether the app restarted.

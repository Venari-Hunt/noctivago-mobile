# Noctívago Mobile

Noctívago for phones: plays presets exported by the desktop app like the Mixer (screen off included), and builds mixes from your own sounds. Plan and phases: `../noctivago/docs/mobile.md`. Expo-specific rules: `AGENTS.md` (Expo changes every SDK; read versioned docs, never memory).

## Architecture

- `App.tsx` — two screens by state (home, player); no router. Home (`src/home/`) has two tabs: Mixes (imported presets) and Sounds (the library).
- `src/library/` — your own sounds: `storage.ts` (copies added files into app storage), `preview.ts` (listen to one), `domain/library.ts` (search, sort, tags, names), `components/`.
- `src/ui/` — small shared pieces (`Choice` pills, `TextPrompt` dialog, `ActionMenu` for hold menus).
- `src/player/` — `storage.ts` (import a phone preset zip, saved mixes in app storage, new/copy/rename, add library sounds, share file), `domain/mixEdit.ts` (pure mix edits: add, remove, turn off, share manifest), `engine.ts` (audio graph, lock-screen controls), `domain/` (pure rules: reading the preset file, clock check), `components/` (screens and small UI pieces).
- `src/player/shotVoice.ts` — Random Interval / Scheduled shots, planned one ahead on the audio clock; the engine re-books a dropped one once a minute (`check()`).
- `src/player/mixGraph.ts` — Fluctuation (drift booked ahead on the audio clock), Sound Group and whole-mix buses; rules in `domain/drift.ts` and `domain/mixPlan.ts`.
- `src/shared/` — copies of the desktop's `src/shared/` rules (shot picks, Fluctuation). Never edit here: change the desktop, then `node scripts/sync-shared.mjs`; `npm test` catches drift.
- `src/player/useIncomingFiles.ts` — files handed over by other apps ("Open with", Share): presets go to Mixes, audio to Sounds; Android filters in `app.json`.
- `src/player/nightLog.ts` — night log for unattended overnight tests; morning read-back `scripts/night-fetch.mjs` + `night-report.mjs`, steps in `docs/night-test.md`.
- `scripts/ab/` — A/B the phone against the desktop engine (record, render, compare); steps in `docs/ab-test.md`.
- `src/updates/` — over-the-air update check.
- `test/` — `node --test` unit tests for `domain/` code.

## Commands

- Tests: `npm test`. Typecheck: `npx tsc --noEmit`. Health: `npx expo-doctor`.
- Cloud build (APK, needs the owner's Expo login): `npx eas-cli build -p android --profile spike`. Only for native changes.
- Over-the-air update (JS/assets only): `npx eas-cli update --channel spike --environment preview --message "..." --non-interactive`. The phone picks it up on next open (`src/updates/useAutoUpdate.ts`).

Audio: `react-native-audio-api` (native Web Audio). Showing `PlaybackNotificationManager` starts Android's media foreground service; that is what keeps audio alive when locked.

Inbox: C:\Claude\Vault Claude\02 - Projetos\Noctívago\Notas para Claude.md (shared with the desktop app).

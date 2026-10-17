# Noctívago Mobile

Player-only Noctívago for phones: imports a preset exported by the desktop app and plays it like the Mixer, screen off included. Plan and phases: `../noctivago/docs/mobile.md`. Expo-specific rules: `AGENTS.md` (Expo changes every SDK; read versioned docs, never memory).

## Architecture

- `App.tsx` — current screen (phase 0: the background-playback spike).
- `src/spike/` — spike audio graph (`engine.ts`) and its `domain/` (pure rules, unit-tested).
- `assets/audio/` — spike test sounds, generated with ffmpeg (see CHANGELOG 0.0.1).
- `test/` — `node --test` unit tests for `domain/` code.

## Commands

- Tests: `npm test`. Typecheck: `npx tsc --noEmit`. Health: `npx expo-doctor`.
- Cloud build (APK, needs the owner's Expo login): `npx eas-cli build -p android --profile spike`.

Audio: `react-native-audio-api` (native Web Audio). Showing `PlaybackNotificationManager` starts Android's media foreground service; that is what keeps audio alive when locked.

Inbox: C:\Claude\Vault Claude\02 - Projetos\Noctívago\Notas para Claude.md (shared with the desktop app).

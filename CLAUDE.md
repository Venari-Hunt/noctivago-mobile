# Noctívago Mobile

Player-only Noctívago for phones: imports a preset exported by the desktop app and plays it like the Mixer, screen off included. Plan and phases: `../noctivago/docs/mobile.md`. Expo-specific rules: `AGENTS.md` (Expo changes every SDK; read versioned docs, never memory).

## Architecture

- `App.tsx` — two screens by state (preset list, player); no router.
- `src/player/` — `storage.ts` (import a phone preset zip, saved presets in app storage), `engine.ts` (audio graph, lock-screen controls), `domain/` (pure rules: reading the preset file, clock check), `components/` (screens and small UI pieces).
- `src/updates/` — over-the-air update check.
- `test/` — `node --test` unit tests for `domain/` code.

## Commands

- Tests: `npm test`. Typecheck: `npx tsc --noEmit`. Health: `npx expo-doctor`.
- Cloud build (APK, needs the owner's Expo login): `npx eas-cli build -p android --profile spike`. Only for native changes.
- Over-the-air update (JS/assets only): `npx eas-cli update --channel spike --message "..." --non-interactive`. The phone picks it up on next open (`src/updates/useAutoUpdate.ts`).

Audio: `react-native-audio-api` (native Web Audio). Showing `PlaybackNotificationManager` starts Android's media foreground service; that is what keeps audio alive when locked.

Inbox: C:\Claude\Vault Claude\02 - Projetos\Noctívago\Notas para Claude.md (shared with the desktop app).

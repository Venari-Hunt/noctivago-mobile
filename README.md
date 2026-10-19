# Noctívago for Android

[Noctívago](https://github.com/Venari-Hunt/Noctivago) ambient mixes on your phone. Export a preset from the desktop app, open it on the phone, and it plays the way the desktop Mixer does, screen off included. You can also add your own sounds; the rest of the desktop Mixer is on its way, and per-sound editing (Remix) comes after.

> Early preview. Android only for now.

## Install

1. Download the latest `.apk` from [Releases](https://github.com/Venari-Hunt/noctivago-mobile/releases).
2. Open it on your phone. Android asks you to allow installs from your browser or file manager the first time.
3. Later updates install by themselves the next time you open the app.

## Get a mix onto the phone

1. In the desktop app, open **Export**, pick the preset, and choose the **For phone** format (desktop v0.1.269 or newer).
2. Send the `.ncvpreset` file to your phone (cable, cloud drive, chat app).
3. On the phone, tap the file, share it to Noctívago, or use **Import preset** in the app.

## Your own sounds

The **Sounds** tab is your library. Tap **Add sounds** to pick audio files from the phone (several at once), share them to Noctívago from another app, add one from a link, browse Freesound, or record one. Tap a sound to listen, hold it to rename, tag or delete.

In **Mixes**, tap **New mix**, then **+ Sounds** at the bottom of the player to add some. The round button on each sound turns it on or off; hold its name to group it or remove it. Random Interval and Scheduled sounds have a small play button that plays one shot right away, to try their settings.

## What it plays

- Loops, Random Interval and Scheduled sounds, with the desktop's own randomizing rules.
- Fluctuation (volume, pitch and pan drift), Sound Groups, and the whole-mix filters and echo.
- Reverb comes baked into the exported file, so the phone doesn't spend battery on it.
- Master and per-sound volumes, a sleep timer, and Play/Pause on the lock screen, all in a bar at the bottom of the player.

Checked on a Galaxy Note 20 with the Beach preset (18 sounds): loudness, tonal balance and stereo balance match the desktop export within 1 dB. Battery and CPU use are still being optimized.

## Build from source

Expo (React Native) with [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api).

```
npm install
npm test
npx eas-cli build -p android --profile spike
```

How the app is laid out: [`CLAUDE.md`](CLAUDE.md). The desktop side of the phone format: the desktop repo's `docs/mobile.md`.

## License

Apache-2.0, like the desktop app.

# Study: SoundAura (how another ambient player plays with the screen off)

SoundAura (Android, Apache-2.0, github.com/CliffracerMerchant/SoundAura, read at release 2.6.4, 2026-09-28). The owner uses it. Notes in our words; no code copied.

## How it plays

- One Media3 ExoPlayer per sound ("playlist"). Each loops with repeat-one (repeat-all for multi-track playlists, optional shuffle); gapless since its 1.6.3.
- Android does all the work: decoding and mixing happen in the system audio server, not in the app. The app does no per-sample math, so CPU is near zero.
- Per-sound volume is the player's own volume. "Volume boost" (0-30 dB) is Android's built-in LoudnessEnhancer effect attached to that player's audio session.
- No filters, reverb or pitch at all.
- Screen off: a foreground service (type mediaPlayback) plus ExoPlayer's local wake mode (a partial wake lock while playing). Audio focus handling, pause on calls and on headphone unplug, auto-stop timer, quick-settings tile.

## What it means for Noctívago mobile

- It confirms our plan (`../noctivago/docs/mobile.md`): the desktop bakes each sound's filters, so the phone only mixes. The less DSP on the phone, the closer we get to SoundAura's battery cost.
- Our spike 0.0.4 spends ~30% of one core with the screen off, almost all of it on the live reverb. Options, cheapest battery first:
  1. Bake the reverb on the PC too. Convolution is linear, so each looping sound can carry its own reverb, wrapped circularly so the loop stays seamless. Scattered one-shots get their tail baked in. The phone then only mixes, like SoundAura.
  2. Android's built-in EnvironmentalReverb/PresetReverb effects (they run in the system audio server). Cheap, but sound and availability vary by phone.
  3. Keep the live convolver with a shorter impulse response.
- What we need beyond SoundAura: scheduled/scatter random sounds and pitch variation. Those need our own scheduler, which react-native-audio-api already gives us; pitch variations could also be baked as a few pre-rendered versions per sound.
- Worth copying as features: pause on calls and headphone unplug, an auto-stop timer in the notification, and a quick-settings tile.

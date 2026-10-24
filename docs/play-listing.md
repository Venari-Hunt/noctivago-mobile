# Google Play listing draft

Draft for the Play Console, written 2026-10-24 from what the app does today. Nothing here is submitted. Plan: free core, one-time Pro unlock (see the Money plan on the board). Check every answer against the live app before submitting.

## Store text

**Title (30 max):** Noctívago: Sleep Sounds

**Short description (80 max):** Mix rain, wind and night sounds your way. Plays all night, screen off.

**Full description:**

Noctívago is a sound mixer for sleep, focus and tinnitus masking. Build your own ambience from rain, wind, thunder, birds and anything else you add, set each sound to the volume you like, and let it play all night with the screen off.

- Mix as many sounds as you want, each with its own volume and on/off switch
- Random Interval and Scheduled sounds (a distant thunder every few minutes, a bird at dawn) with natural randomness
- Sound Groups, and a gentle drift in volume, pitch and pan so the mix never feels like a loop
- Sleep timer that fades out by itself
- Add your own sounds, record one, or browse free sounds from Freesound
- Open mixes made in the Noctívago desktop app, or download shared mixes from the Community tab
- No account, no ads, no tracking. Your mixes stay on your phone.

Free: everything for mixing and playing. Pro (one-time, no subscription): to be decided, see the Money plan.

## Data safety form (answers for the current app)

| Question | Answer | Why |
|---|---|---|
| Collects or shares user data? | No data collected, none shared | Mixes, sounds and settings stay on the phone; the error log never leaves it (the user can share it by hand) |
| Data encrypted in transit? | Yes | All requests use HTTPS |
| Can users ask to delete data? | Not applicable | No account and no data on a server. See "Delete-my-data check" on the board before adding anything that changes this |

Network use to mention in the privacy policy: Freesound searches (the search words go to freesound.org), the Community tab (lists and downloads shared mixes), a link the user types in, and the update check (Expo). Re-answer the form if any of these starts sending something about the user.

## Permissions to justify

| Permission | Used for |
|---|---|
| FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK | Playing the mix with the screen off |
| POST_NOTIFICATIONS | The playback notification and lock-screen controls |
| MODIFY_AUDIO_SETTINGS | Audio focus while playing |
| RECORD_AUDIO | The Sounds tab "Record" button; the microphone is used only while the user records a sound |

## Still needed before submitting

1. Play Console account (board: waiting on the owner).
2. A public privacy policy URL (the in-app Privacy text is the source; it needs a page, for example on the docs site).
3. Screenshots (phone, 2-8), a 512x512 icon and a 1024x500 feature graphic.
4. Content rating questionnaire (expected: everyone).
5. Pro purchase wiring (Play Billing), after the price is chosen.

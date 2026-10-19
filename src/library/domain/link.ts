// Adding a sound from a link: a direct link to an audio file. Pure rules,
// no network, so `npm test` can load it. Video sites (YouTube…) need the
// PC: the desktop fetches those with yt-dlp, which doesn't run on a phone.

// Past this a download is refused: a 10-minute WAV is ~100 MB, and every
// sound is decoded whole while playing.
export const MAX_LINK_BYTES = 200 * 1024 * 1024;

const VIDEO_SITES = ['youtube.com', 'youtu.be', 'soundcloud.com', 'vimeo.com', 'tiktok.com', 'instagram.com', 'twitch.tv', 'bandcamp.com'];

export type LinkCheck = { ok: true; url: string } | { ok: false; error: string };

// Accepts what people paste: spaces around it, no "https://" in front.
export function checkLink(text: string): LinkCheck {
  let raw = text.trim();
  if (!raw) return { ok: false, error: 'Paste a link first.' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'Only http and https links work.' };
  if (!url.hostname.includes('.')) return { ok: false, error: "That doesn't look like a link." };
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  if (VIDEO_SITES.some((site) => host === site || host.endsWith(`.${site}`))) {
    return { ok: false, error: 'Links from video and music sites only work in the PC app. Here, use a direct link to an audio file (ending in .mp3, .wav, .ogg…).' };
  }
  return { ok: true, url: url.toString() };
}

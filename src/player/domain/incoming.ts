// Files other apps hand to Noctívago:
//   "Open with" → a link that is the file itself: content://… or file://…
//   Share       → expo-sharing payloads (useIncomingShare), not a link

// The file a link points at, or null for a plain launch (noctivago:///) and
// expo-sharing's own noctivago://expo-sharing link.
export function incomingFileUri(url: string | null | undefined): string | null {
  return url && /^(content|file):\/\//i.test(url) ? url : null;
}

type Payload = { shareType?: string; value?: string };

// The shared file's URI from expo-sharing's payloads; texts and links are not presets.
export function sharedFileUri(payloads: Payload[]): string | null {
  const file = payloads.find((p) => p.shareType !== 'text' && p.shareType !== 'url' && p.value);
  return file?.value ?? null;
}

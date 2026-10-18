// Files other apps hand to Noctívago:
//   "Open with" → a link that is the file itself: content://… or file://…
//   Share       → expo-sharing payloads (useIncomingShare), not a link

// The file a link points at, or null for a plain launch (noctivago:///) and
// expo-sharing's own noctivago://expo-sharing link.
export function incomingFileUri(url: string | null | undefined): string | null {
  return url && /^(content|file):\/\//i.test(url) ? url : null;
}

type Payload = { shareType?: string; value?: string; mimeType?: string };
type Resolved = { value?: string; originalName?: string | null; contentMimeType?: string | null };

/** A file another app handed over: its URI, and its name and type when known. */
export type IncomingFile = { uri: string; name: string | null; mimeType: string | null };

// The shared files (one or several), with the names and types expo-sharing
// resolved for them; texts and links are not files.
export function sharedFiles(payloads: Payload[], resolved: Resolved[] = []): IncomingFile[] {
  return payloads
    .filter((p) => p.shareType !== 'text' && p.shareType !== 'url' && p.value)
    .map((p) => {
      const r = resolved.find((x) => x.value === p.value);
      return { uri: p.value as string, name: r?.originalName ?? null, mimeType: r?.contentMimeType ?? p.mimeType ?? null };
    });
}

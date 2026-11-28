/**
 * share.ts - Links that carry a notation, so the docs site can share one without a server.
 *
 * A link follows thambura's share links (thambura's `engine/shareLink.ts`): a format byte and a
 * payload, as base64url without padding. Format 1's payload is the UTF-8 source, deflated
 * ("deflate-raw"). It goes after `#s=` in a /view/ or playground URL. A fragment never reaches
 * the server, so a long song can't run into a request-line limit.
 *
 * A library song that hasn't been edited is shared as its library page instead, whose path
 * mirrors the song's `.sng` path (#107).
 */

const FORMAT_SOURCE = 1;

/** Packs `source` into a link payload, the part after `#s=`. */
export async function encodeSource(source: string): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(source), new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(packed.length + 1);
  bytes[0] = FORMAT_SOURCE;
  bytes.set(packed, 1);
  return toBase64Url(bytes);
}

/**
 * The source a link payload carries, or null when it isn't a payload this version can read: not
 * base64url, an unknown format, empty, or cut short.
 */
export async function decodeSource(link: string): Promise<string | null> {
  const bytes = fromBase64Url(link);
  if (!bytes || bytes.length < 2 || bytes[0] !== FORMAT_SOURCE) return null;
  try {
    const raw = await pipe(bytes.subarray(1), new DecompressionStream("deflate-raw"));
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return null;
  }
}

/** What the playground opens with. */
export type InitialSource =
  | { kind: "link"; link: string }
  | { kind: "song"; song: string }
  | { kind: "draft"; source: string }
  | { kind: "sample" };

/**
 * Picks what the playground opens with: a `#s=` link first, then a `?song=` library path, then
 * the draft kept from the last visit, then a sample. A song path is letters, digits, `-` and
 * `/` only, so it can't reach outside `library/`.
 */
export function initialSource(at: { hash: string; search: string; draft: string | null }): InitialSource {
  const link = /^#s=(.+)$/.exec(at.hash)?.[1];
  if (link) return { kind: "link", link };
  const song = new URLSearchParams(at.search).get("song");
  if (song && /^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(song)) return { kind: "song", song };
  if (at.draft) return { kind: "draft", source: at.draft };
  return { kind: "sample" };
}

/**
 * The link Share gives for `source`. While it is still the library song it was opened from, the
 * link is that song's page. Otherwise it is a /view/ link carrying the source. `base` is the
 * site's root URL, with no trailing slash.
 */
export async function shareUrl(at: {
  source: string;
  song: { path: string; source: string } | null;
  base: string;
}): Promise<string> {
  if (at.song && at.song.source === at.source) return `${at.base}/library/${at.song.path}/`;
  return `${at.base}/view/#s=${await encodeSource(at.source)}`;
}

async function pipe(input: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([input as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

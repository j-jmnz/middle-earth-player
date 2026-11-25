// Discord signs every interaction it sends with the application's Ed25519 key: the signature covers the timestamp header
// followed by the raw body. A request that fails the check is answered 401, which is also what Discord's own test of the
// endpoint URL expects (docs/discord-issues.md, Create the Discord application). The timestamp is signed, so an old
// one marks a request that was recorded and sent again: it is refused as well.

/** The bytes a hex string spells, or null when it is not hex. */
export function bytesOfHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

// The furthest a request's timestamp may be from the Worker's clock, in seconds.
const TIMESTAMP_WINDOW = 5 * 60;

/** Whether `timestamp` (seconds since 1970, as Discord's header writes it) is within five minutes of `nowMs`. */
export function freshTimestamp(timestamp: string, nowMs: number): boolean {
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  return Math.abs(nowMs / 1000 - Number(timestamp)) <= TIMESTAMP_WINDOW;
}

/** Whether `body` was signed by the holder of `publicKeyHex` at `timestamp`, and `timestamp` is within five minutes of `nowMs`. */
export async function verifyDiscordRequest(publicKeyHex: string, signatureHex: string | null, timestamp: string | null, body: string, nowMs: number): Promise<boolean> {
  const key = bytesOfHex(publicKeyHex);
  const signature = signatureHex ? bytesOfHex(signatureHex) : null;
  if (!key || !signature || !timestamp || !freshTimestamp(timestamp, nowMs)) return false;
  const imported = await crypto.subtle.importKey("raw", key, { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, imported, signature, new TextEncoder().encode(timestamp + body));
}

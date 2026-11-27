// The test site's store of meter logs (docs/development.md, The web app on Cloudflare). The web app's test meter (src/ui/web/render-scale.ts, `?fps=1`) posts its
// log here every few seconds, and a GET reads the newest back, so a device's numbers are read without a photo of its screen. Only a deploy that has the store keeps
// any: the test site's (webapp/wrangler.toml, METER). The permanent site has none, and the path is then not found.

/** The part of a Workers KV namespace the logs use. */
export interface MeterStore {
  put(key: string, value: string, options?: { expirationTtl: number }): Promise<void>;
  get(key: string): Promise<string | null>;
  list(options: { prefix: string; limit: number }): Promise<{ keys: { name: string }[] }>;
}

export const METER_PATH = "/_meter";
// One sending is ten seconds of the log; a larger body is not a log.
const MAX_BYTES = 64 * 1024;
// A log is kept a week.
const KEEP_SECONDS = 7 * 24 * 3600;
// How many logs a read gives when it names no number, and the most it gives.
const SHOWN = 30;
const SHOWN_MAX = 200;
const PREFIX = "log:";
// Keys sort oldest last: a list reads in key order, and the newest are wanted first.
const KEY_BASE = 9_000_000_000_000_000;

/** The key of a log written at `now` (ms): later sorts earlier, and `salt` keeps two of one millisecond apart. */
export function meterKey(now: number, salt: string): string {
  return `${PREFIX}${String(KEY_BASE - now).padStart(16, "0")}:${salt}`;
}

/** Answers a request to METER_PATH: a POST keeps the body as one log, a GET returns the newest logs as text (`?n=` how many). */
export async function handleMeter(request: Request, store: MeterStore, now: number, salt: string): Promise<Response> {
  if (request.method === "POST") {
    const body = await request.text();
    if (body.length === 0 || body.length > MAX_BYTES) return new Response(null, { status: 413 });
    await store.put(meterKey(now, salt), body, { expirationTtl: KEEP_SECONDS });
    return new Response(null, { status: 204 });
  }
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  const asked = Number(new URL(request.url).searchParams.get("n") ?? SHOWN);
  const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, SHOWN_MAX) : SHOWN;
  const { keys } = await store.list({ prefix: PREFIX, limit });
  const logs = await Promise.all(keys.map((key) => store.get(key.name)));
  const text = logs.filter((log): log is string => log !== null).join("\n\n----\n\n");
  return new Response(text === "" ? "no logs\n" : `${text}\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

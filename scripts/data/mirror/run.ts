import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bytes, describeError, runScript, type Log } from "../../log.ts";
import { DATA_DIR, PDF_CACHE_DIR, PICTURE_CACHE_DIR, SCAN_CACHE_DIR } from "../paths.ts";
import { fetchBytesRetrying, RETRY_WAITS_MS, sha256, type SourceFile, type SourceRecord } from "../sources/fetch.ts";
import { MIRROR_ENV, mirrorFromEnv, type Mirror } from "./client.ts";

// `pnpm data mirror push [--fetch]|pull [source...]` (docs/development.md, Asset mirror). push uploads every pinned file in
// .cache the bucket does not hold (--fetch downloads one .cache misses from its URL first); pull fills .cache with every pinned file it lacks. Only the cached sources take part: data/raw
// is committed.

export type CacheDirs = { scans: string; pictures: string; pdf: string };

const HERE: CacheDirs = { scans: SCAN_CACHE_DIR, pictures: PICTURE_CACHE_DIR, pdf: PDF_CACHE_DIR };
const CONCURRENCY = 8;

/** Where a pin is cached: `.cache/<scans|pictures|pdf>/<name>`, or null for a file under data/raw. */
export function cachePathOf(file: SourceFile, dirs: CacheDirs): string | null {
  const folder = /^(scans|pictures|pdf)\//.exec(file.path)?.[1] as keyof CacheDirs | undefined;
  return folder ? path.join(dirs[folder], path.basename(file.path)) : null;
}

/** The cached pins of the named sources (every source when none is named), one per hash. */
export function cachedPins(sources: Partial<Record<string, SourceRecord>>, wanted: readonly string[], dirs: CacheDirs): { file: SourceFile; cached: string }[] {
  const unknown = wanted.filter((id) => !sources[id]);
  if (unknown.length > 0) throw new Error(`data/sources.json has no source ${unknown.join(", ")}; it has ${Object.keys(sources).join(", ")}`);
  const byHash = new Map<string, { file: SourceFile; cached: string }>();
  for (const [id, record] of Object.entries(sources)) {
    if (wanted.length > 0 && !wanted.includes(id)) continue;
    for (const file of record?.files ?? []) {
      const cached = cachePathOf(file, dirs);
      if (cached && !byHash.has(file.sha256)) byHash.set(file.sha256, { file, cached });
    }
  }
  return [...byHash.values()];
}

const atPin = (cached: string, hash: string): Uint8Array | null => {
  if (!existsSync(cached)) return null;
  const body = new Uint8Array(readFileSync(cached));
  return sha256(body) === hash ? body : null;
};

/**
 * Uploads every pin the bucket lacks from the cache at its pin. With `fetchSource` (`push --fetch`), a pin the cache misses is
 * fetched from its URL into the cache first, so the mirror gets the files no pack reads (a scan a picture stands in for). A
 * page rendered from a PDF has no URL to fetch: only a cached render at its pin is pushed.
 */
export async function pushPins(
  mirror: Mirror,
  pins: readonly { file: SourceFile; cached: string }[],
  log: Log,
  options: { waits?: readonly number[]; fetchSource?: (url: string) => Promise<Uint8Array> } = {},
): Promise<{ pushed: number; held: number; absent: string[] }> {
  const waits = options.waits ?? RETRY_WAITS_MS;
  const held = await mirror.list();
  const todo = pins.filter((pin) => !held.has(pin.file.sha256));
  const absent: string[] = [];
  let pushed = 0;
  let sent = 0;
  const tick = log.progress(todo.length, "upload");
  await eachAtOnce(todo, async ({ file, cached }) => {
    const body = atPin(cached, file.sha256) ?? (await fromSource(file, cached, options.fetchSource, log));
    if (!body) {
      absent.push(file.path);
      tick(`${file.path} not in the cache at its pin`);
      return;
    }
    await retrying(() => mirror.put(file.sha256, body), waits, log, file.path);
    pushed += 1;
    sent += body.byteLength;
    tick(`${file.path} ${bytes(body.byteLength)}`);
  });
  absent.sort();
  log.info(`pushed ${pushed} file${pushed === 1 ? "" : "s"} (${bytes(sent)}) to ${mirror.name}; ${pins.length - todo.length} already there`);
  if (absent.length > 0) {
    const hint = options.fetchSource ? "their URL failed or answered other bytes; pnpm data sync moves a changed pin" : "pnpm data mirror push --fetch downloads them from their URLs first";
    log.info(`${absent.length} pinned file${absent.length === 1 ? " is" : "s are"} not in .cache at their pin, so not pushed (${hint})`);
    log.debug(absent.join(", "));
  }
  return { pushed, held: pins.length - todo.length, absent };
}

export async function pullPins(mirror: Mirror, pins: readonly { file: SourceFile; cached: string }[], log: Log): Promise<{ pulled: number; missing: string[] }> {
  const todo = pins.filter((pin) => atPin(pin.cached, pin.file.sha256) === null);
  const missing: string[] = [];
  let pulled = 0;
  let received = 0;
  const tick = log.progress(todo.length, "download");
  await eachAtOnce(todo, async ({ file, cached }) => {
    const body = await mirror.get(file.sha256);
    if (!body || sha256(body) !== file.sha256) {
      missing.push(file.path);
      tick(`${file.path} not in the mirror`);
      return;
    }
    mkdirSync(path.dirname(cached), { recursive: true });
    writeFileSync(cached, body);
    pulled += 1;
    received += body.byteLength;
    tick(`${file.path} ${bytes(body.byteLength)}`);
  });
  missing.sort();
  log.info(`pulled ${pulled} file${pulled === 1 ? "" : "s"} (${bytes(received)}) from ${mirror.name}; ${pins.length - todo.length} already cached`);
  if (missing.length > 0) {
    log.warn(`${missing.length} pinned file${missing.length === 1 ? " is" : "s are"} not in the mirror; pnpm data mirror push on a machine that has them adds them`);
    log.debug(missing.join(", "));
  }
  return { pulled, missing };
}

// The pin fetched from its URL and kept in the cache, or null for a rendered PDF page, a failed fetch or other bytes.
async function fromSource(file: SourceFile, cached: string, fetchSource: ((url: string) => Promise<Uint8Array>) | undefined, log: Log): Promise<Uint8Array | null> {
  if (!fetchSource || file.url.includes("#page=")) return null;
  try {
    const body = await fetchSource(file.url);
    if (sha256(body) !== file.sha256) {
      log.warn(`${file.path}: ${file.url} has sha256 ${sha256(body)}, pinned ${file.sha256}; not pushed`);
      return null;
    }
    mkdirSync(path.dirname(cached), { recursive: true });
    writeFileSync(cached, body);
    return body;
  } catch (error) {
    log.warn(`${file.path}: ${describeError(error)}; not pushed`);
    return null;
  }
}

async function eachAtOnce<T>(items: readonly T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const item = items[next++];
        if (item !== undefined) await work(item);
      }
    }),
  );
}

async function retrying(work: () => Promise<void>, waits: readonly number[], log: Log, what: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      const wait = waits[attempt];
      if (wait === undefined) throw error;
      log.warn(`${what}: ${describeError(error)}; trying again`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return entry ? path.resolve(entry) === fileURLToPath(import.meta.url) : false;
}

if (isDirectRun()) {
  void runScript("data:mirror", async (log) => {
    const [command, ...wanted] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
    if (command !== "push" && command !== "pull") throw new Error("Usage: pnpm data mirror push [--fetch] | pull [source...]");
    const mirror = mirrorFromEnv();
    if (!mirror) throw new Error(`No asset mirror: set ${MIRROR_ENV.join(", ")} (docs/development.md, Asset mirror)`);
    const { sources } = JSON.parse(readFileSync(path.join(DATA_DIR, "sources.json"), "utf8")) as { sources: Partial<Record<string, SourceRecord>> };
    const pins = cachedPins(sources, wanted, HERE);
    const fetchSource = process.argv.includes("--fetch") ? (url: string) => fetchBytesRetrying(url, 120_000, log) : undefined;
    if (command === "push") await pushPins(mirror, pins, log, { fetchSource });
    else await pullPins(mirror, pins, log);
  });
}

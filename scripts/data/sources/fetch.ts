import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { bytes, createLog, duration, type Log } from "../../log.ts";
import { RAW_DIR } from "../paths.ts";

// One fetched file: where it came from and the hash of the bytes we kept.
export type SourceFile = { path: string; url: string; sha256: string; bytes: number };

export type SourceRecord = {
  id: string;
  site: string;
  pin: { kind: "sha256" | "git"; value: string };
  fetchedAt: string;
  files: SourceFile[];
  // Absent on an official source. A fan-made source names its publisher and its licence (scripts/data/sources/origins.ts).
  origin?: "official" | "fan-made";
  publisher?: string;
  licence?: string;
};

export function sha256(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

const fetchLog = createLog("fetch");

// A response that came back with an error status: its message is already the whole story.
export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * GETs one URL. Each request is logged at debug with its status, size and time; a failure names the URL, the status or
 * the timeout, and keeps the network error as its cause (describeError prints it).
 */
export async function fetchBytes(url: string, timeoutMs = 120_000, log: Log = fetchLog): Promise<Uint8Array> {
  const begin = performance.now();
  const took = () => duration(performance.now() - begin);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new HttpError(`GET ${url} answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""} after ${took()}`, response.status);
    const body = new Uint8Array(await response.arrayBuffer());
    log.debug(`GET ${url} ${response.status}, ${bytes(body.byteLength)} in ${took()}`);
    return body;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.name === "TimeoutError") throw new Error(`GET ${url} timed out after ${duration(timeoutMs)}`, { cause: error });
    throw new Error(`GET ${url} failed after ${took()}`, { cause: error });
  }
}

/** How fetchBytesRetrying spaces its attempts: the waits between them, in milliseconds. */
export const RETRY_WAITS_MS: readonly number[] = [1_000, 4_000, 15_000];

/**
 * fetchBytes, tried again after each wait when the connection drops, the request times out or the server answers 429
 * or 5xx. Another status is final. A long run of downloads (every card picture on a release build) meets a dropped
 * connection now and then, and one must not fail the build.
 */
export async function fetchBytesRetrying(url: string, timeoutMs = 120_000, log: Log = fetchLog, waits: readonly number[] = RETRY_WAITS_MS): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchBytes(url, timeoutMs, log);
    } catch (error) {
      const wait = waits[attempt];
      const final = error instanceof HttpError && error.status !== 429 && error.status < 500;
      if (wait === undefined || final) throw error;
      log.warn(`${error instanceof Error ? error.message : String(error)}; trying again in ${duration(wait)}`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

/**
 * A pinned file from its URL: `fetchOne`, tried again after each wait while the bytes do not hash to the pin. Google Drive
 * now and then answers 200 with a quota or sign-in page, or with a cut-off body, in place of the file, and the next request
 * gets the file. Returns the last body with its hash; the caller fails on a hash that is still not the pin (the file
 * changed upstream).
 */
export async function fetchAtPin(
  url: string,
  pin: string,
  fetchOne: (url: string) => Promise<Uint8Array>,
  log: Log = fetchLog,
  waits: readonly number[] = RETRY_WAITS_MS,
): Promise<{ body: Uint8Array; hash: string }> {
  for (let attempt = 0; ; attempt += 1) {
    const body = await fetchOne(url);
    const hash = sha256(body);
    const wait = waits[attempt];
    if (hash === pin || wait === undefined) return { body, hash };
    log.warn(`GET ${url} gave ${bytes(body.byteLength)} with sha256 ${hash}, pinned ${pin}; trying again in ${duration(wait)}`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

export async function fetchText(url: string, timeoutMs = 120_000, log: Log = fetchLog): Promise<string> {
  return new TextDecoder().decode(await fetchBytes(url, timeoutMs, log));
}

/** How a fresh record differs from the one data/sources.json held: files added, removed and changed, and the pin. */
export function recordChanges(previous: SourceRecord | undefined, next: SourceRecord): string {
  const total = next.files.reduce((sum, file) => sum + file.bytes, 0);
  const head = `${next.files.length} file${next.files.length === 1 ? "" : "s"}, ${bytes(total)}`;
  if (!previous) return `${head}; first sync`;
  if (previous.pin.value === next.pin.value) return `${head}; pin unchanged`;
  const before = new Map(previous.files.map((file) => [file.path, file.sha256]));
  const after = new Map(next.files.map((file) => [file.path, file.sha256]));
  const added = [...after.keys()].filter((name) => !before.has(name));
  const removed = [...before.keys()].filter((name) => !after.has(name));
  const changed = [...after].filter(([name, hash]) => before.has(name) && before.get(name) !== hash).map(([name]) => name);
  const list = (names: string[]) => (names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`);
  const parts = [
    added.length > 0 ? `${added.length} added (${list(added)})` : null,
    removed.length > 0 ? `${removed.length} removed (${list(removed)})` : null,
    changed.length > 0 ? `${changed.length} changed (${list(changed)})` : null,
  ].filter((part) => part != null);
  return `${head}; pin ${previous.pin.value.slice(0, 12)} -> ${next.pin.value.slice(0, 12)}${parts.length > 0 ? `: ${parts.join(", ")}` : ""}`;
}

// Writes the payload verbatim under data/raw/<relative> and returns its record.
export function writeRaw(relative: string, url: string, body: string): SourceFile {
  const file = path.join(RAW_DIR, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
  return { path: `raw/${relative}`, url, sha256: sha256(body), bytes: Buffer.byteLength(body) };
}

export function combinedPin(files: readonly SourceFile[]): string {
  return sha256([...files].sort((a, b) => a.path.localeCompare(b.path)).map((file) => `${file.path} ${file.sha256}`).join("\n"));
}

// Writes binary bytes verbatim under data/raw/<relative> (an image) and returns its record.
export function writeRawBytes(relative: string, url: string, body: Uint8Array): SourceFile {
  const file = path.join(RAW_DIR, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
  return { path: `raw/${relative}`, url, sha256: sha256(body), bytes: body.byteLength };
}

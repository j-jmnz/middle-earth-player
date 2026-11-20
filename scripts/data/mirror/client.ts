import { AwsClient } from "aws4fetch";

import { describeError, type Log } from "../../log.ts";
import { sha256 } from "../sources/fetch.ts";

// The asset mirror: a private Cloudflare R2 bucket that holds every file data/sources.json pins, each at `sha256/<hash>`
// (docs/development.md, Asset mirror). A key names its bytes, so an object never goes stale. It is a cache in front of the
// sources, not a source: the pins keep the original URLs, a build reads the mirror first and falls back to the URL, and
// every body is checked against its pin either way.

/** The four variables a mirror needs; a machine without all of them reads the sources as before. */
export const MIRROR_ENV = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

export type Mirror = {
  /** The bucket, for log lines. */
  readonly name: string;
  /** The object at the hash, or null when the bucket has none. */
  get(hash: string): Promise<Uint8Array | null>;
  put(hash: string, body: Uint8Array): Promise<void>;
  /** Every hash the bucket holds. */
  list(): Promise<Set<string>>;
};

type Send = (request: Request) => Promise<Response>;

const TIMEOUT_MS = 120_000;
const PREFIX = "sha256/";

/** The mirror the environment names, or null when one of MIRROR_ENV is missing or ASSET_MIRROR is `off`. */
export function mirrorFromEnv(env: Readonly<Record<string, string | undefined>> = process.env, send: Send = (request) => fetch(request)): Mirror | null {
  if (env.ASSET_MIRROR === "off") return null;
  const [account, accessKeyId, secretAccessKey, bucket] = MIRROR_ENV.map((name) => env[name]?.trim() ?? "");
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null;
  return r2Mirror({ account, accessKeyId, secretAccessKey, bucket }, send);
}

export function r2Mirror(config: { account: string; accessKeyId: string; secretAccessKey: string; bucket: string }, send: Send): Mirror {
  // aws4fetch's own retries are off: a miss falls back to the source, and the push command retries a failed put itself.
  const client = new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, service: "s3", region: "auto", retries: 0 });
  const base = `https://${config.account}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucket)}`;
  const signed = async (url: string, init: RequestInit = {}) => send(await client.sign(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }));
  const fail = async (what: string, response: Response) => new Error(`R2 ${what} answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""}: ${(await response.text()).slice(0, 200)}`);
  return {
    name: config.bucket,
    async get(hash) {
      const response = await signed(`${base}/${PREFIX}${hash}`);
      if (response.status === 404) return null;
      if (!response.ok) throw await fail(`GET ${PREFIX}${hash}`, response);
      return new Uint8Array(await response.arrayBuffer());
    },
    async put(hash, body) {
      const response = await signed(`${base}/${PREFIX}${hash}`, { method: "PUT", body: body as Uint8Array<ArrayBuffer>, headers: { "content-type": "application/octet-stream" } });
      if (!response.ok) throw await fail(`PUT ${PREFIX}${hash}`, response);
    },
    async list() {
      const hashes = new Set<string>();
      let token: string | null = null;
      do {
        const query = new URLSearchParams({ "list-type": "2", prefix: PREFIX, "max-keys": "1000" });
        if (token) query.set("continuation-token", token);
        const response = await signed(`${base}?${query.toString()}`);
        if (!response.ok) throw await fail("list", response);
        const xml = await response.text();
        for (const match of xml.matchAll(/<Key>sha256\/([0-9a-f]{64})<\/Key>/g)) if (match[1]) hashes.add(match[1]);
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null) : null;
      } while (token);
      return hashes;
    },
  };
}

/**
 * Reads pinned bytes from the mirror for a build. It answers null on a miss, on an object whose hash is not its key, and
 * after the first error (no network, a refused key): the build then fetches the source, and a broken mirror costs one
 * warning, not one per file.
 */
export function mirrorReader(mirror: Mirror | null, log: Log): (hash: string) => Promise<Uint8Array | null> {
  let broken = mirror === null;
  return async (hash) => {
    if (broken || !mirror) return null;
    try {
      const body = await mirror.get(hash);
      if (body === null) {
        log.debug(`mirror ${mirror.name} has no ${hash}`);
        return null;
      }
      if (sha256(body) !== hash) {
        log.warn(`mirror ${mirror.name}: ${PREFIX}${hash} holds other bytes; reading the source. Delete the object and run pnpm data mirror push.`);
        return null;
      }
      return body;
    } catch (error) {
      broken = true;
      log.warn(`mirror ${mirror.name} is not answering (${describeError(error)}); this run reads the sources`);
      return null;
    }
  };
}

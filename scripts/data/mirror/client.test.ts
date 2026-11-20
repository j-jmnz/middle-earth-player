import { describe, expect, it } from "vitest";

import { createLog } from "../../log.ts";
import { sha256 } from "../sources/fetch.ts";
import { mirrorFromEnv, mirrorReader, r2Mirror, type Mirror } from "./client.ts";

const CONFIG = { account: "acct", accessKeyId: "AKID", secretAccessKey: "secret", bucket: "assets" };
const log = createLog("mirror-test");

// An in-memory bucket that answers the S3 requests r2Mirror sends, two keys a list page so the paging runs.
function fakeBucket(objects = new Map<string, Uint8Array>()) {
  const seen: Request[] = [];
  const send = async (request: Request): Promise<Response> => {
    seen.push(request);
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/assets\/?/, ""));
    if (request.method === "PUT") {
      objects.set(key, new Uint8Array(await request.arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    if (key === "") {
      const keys = [...objects.keys()].sort();
      const start = Number(url.searchParams.get("continuation-token") ?? "0");
      const page = keys.slice(start, start + 2);
      const more = start + 2 < keys.length;
      const body = `<ListBucketResult>${page.map((name) => `<Contents><Key>${name}</Key></Contents>`).join("")}<IsTruncated>${more}</IsTruncated>${more ? `<NextContinuationToken>${start + 2}</NextContinuationToken>` : ""}</ListBucketResult>`;
      return new Response(body, { status: 200 });
    }
    const body = objects.get(key);
    return body ? new Response(body as Uint8Array<ArrayBuffer>, { status: 200 }) : new Response("NoSuchKey", { status: 404 });
  };
  return { objects, seen, send };
}

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe("r2Mirror", () => {
  it("puts, gets and lists objects by hash, signed for R2", async () => {
    const bucket = fakeBucket();
    const mirror = r2Mirror(CONFIG, bucket.send);
    const bodies = ["one", "two", "three"].map(bytesOf);
    for (const body of bodies) await mirror.put(sha256(body), body);
    expect(await mirror.list()).toEqual(new Set(bodies.map((body) => sha256(body))));
    expect(await mirror.get(sha256(bodies[1] ?? new Uint8Array()))).toEqual(bodies[1]);
    expect(await mirror.get("0".repeat(64))).toBeNull();
    const first = bucket.seen[0];
    expect(first?.url).toBe(`https://acct.r2.cloudflarestorage.com/assets/sha256/${sha256(bodies[0] ?? new Uint8Array())}`);
    expect(first?.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\/\d{8}\/auto\/s3\/aws4_request/);
  });

  it("throws on an answer that is neither an object nor a miss", async () => {
    const mirror = r2Mirror(CONFIG, () => Promise.resolve(new Response("AccessDenied", { status: 403 })));
    await expect(mirror.get("a".repeat(64))).rejects.toThrow(/403/);
  });
});

describe("mirrorFromEnv", () => {
  const env = { R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "AKID", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "assets" };

  it("needs all four variables, and ASSET_MIRROR=off turns it off", () => {
    expect(mirrorFromEnv(env)?.name).toBe("assets");
    expect(mirrorFromEnv({ ...env, R2_BUCKET: "" })).toBeNull();
    expect(mirrorFromEnv({ ...env, ASSET_MIRROR: "off" })).toBeNull();
  });
});

describe("mirrorReader", () => {
  const body = bytesOf("picture");
  const hash = sha256(body);

  it("returns the object only when its bytes hash to its key", async () => {
    const good: Mirror = { name: "m", get: () => Promise.resolve(body), put: () => Promise.resolve(), list: () => Promise.resolve(new Set()) };
    const wrong: Mirror = { ...good, get: () => Promise.resolve(bytesOf("other")) };
    expect(await mirrorReader(good, log)(hash)).toEqual(body);
    expect(await mirrorReader(wrong, log)(hash)).toBeNull();
    expect(await mirrorReader(null, log)(hash)).toBeNull();
  });

  it("stops asking after the first error", async () => {
    let calls = 0;
    const down: Mirror = {
      name: "m",
      get: () => {
        calls += 1;
        return Promise.reject(new Error("offline"));
      },
      put: () => Promise.resolve(),
      list: () => Promise.resolve(new Set()),
    };
    const read = mirrorReader(down, log);
    expect(await read(hash)).toBeNull();
    expect(await read(hash)).toBeNull();
    expect(calls).toBe(1);
  });
});

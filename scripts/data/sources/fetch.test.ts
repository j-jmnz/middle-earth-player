// fetchBytesRetrying (scripts/data/sources/fetch.ts): a dropped connection, a timeout, a 429 or a 5xx is tried again
// after each wait; another status, or the last failure, is thrown.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLog } from "../../log.ts";
import { fetchBytesRetrying, rawPath, writeRaw, writeRawBytes } from "./fetch.ts";

const log = createLog("fetch-test");
const NO_WAIT = [0, 0, 0];

/** Stubs the global fetch with one answer per call: an Error rejects, a number is that status, anything else a 200. */
function answers(...replies: (Error | number | string)[]): ReturnType<typeof vi.fn> {
  const stub = vi.fn(async () => {
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    if (typeof reply === "number") return new Response("no", { status: reply });
    return new Response(reply ?? "");
  });
  vi.stubGlobal("fetch", stub);
  return stub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBytesRetrying", () => {
  it("tries again after a dropped connection and a server error", async () => {
    const stub = answers(new TypeError("fetch failed"), 503, "picture");
    expect(new TextDecoder().decode(await fetchBytesRetrying("https://example.test/a", 1_000, log, NO_WAIT))).toBe("picture");
    expect(stub).toHaveBeenCalledTimes(3);
  });

  it("tries again after a 429", async () => {
    const stub = answers(429, "picture");
    await fetchBytesRetrying("https://example.test/a", 1_000, log, NO_WAIT);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it("does not try a 404 again", async () => {
    const stub = answers(404, "picture");
    await expect(fetchBytesRetrying("https://example.test/a", 1_000, log, NO_WAIT)).rejects.toThrow("answered 404");
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("throws the last failure once the waits run out", async () => {
    const stub = answers(500, 500, 500, 502);
    await expect(fetchBytesRetrying("https://example.test/a", 1_000, log, NO_WAIT)).rejects.toThrow("answered 502");
    expect(stub).toHaveBeenCalledTimes(4);
  });
});

describe("rawPath", () => {
  const root = "/repo/data/raw";

  it("keeps a source's file under data/raw", () => {
    expect(rawPath("ringsdb/cards/Core.json", root)).toBe("/repo/data/raw/ringsdb/cards/Core.json");
    expect(rawPath("hallofbeorn/scenarios/a-b/../c.json", root)).toBe("/repo/data/raw/hallofbeorn/scenarios/c.json");
  });

  it("refuses a name that leaves data/raw, with nothing written", () => {
    for (const name of ["ringsdb/cards/../../../../etc/passwd.json", "../raw-other/x.json", "/etc/passwd", "..", "", "ringsdb/a\0.json"]) {
      expect(() => rawPath(name, root), name).toThrow("outside data/raw");
    }
    expect(() => writeRaw("ringsdb/cards/../../../../../tmp/escaped.json", "https://example.test", "{}")).toThrow("outside data/raw");
    expect(() => writeRawBytes("../escaped.png", "https://example.test", new Uint8Array(1))).toThrow("outside data/raw");
  });
});

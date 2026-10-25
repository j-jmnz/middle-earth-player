import { describe, expect, it } from "vitest";

import { recordChanges, type SourceRecord } from "./data/sources/fetch.ts";
import { bytes, describeError, duration } from "./log.ts";

describe("script logs", () => {
  it("print durations and sizes a person reads", () => {
    expect(duration(340)).toBe("340 ms");
    expect(duration(2400)).toBe("2.4 s");
    expect(duration(192_000)).toBe("3 min 12 s");
    expect(bytes(812)).toBe("812 B");
    expect(bytes(14_540)).toBe("14.2 KB");
    expect(bytes(3_250_000)).toBe("3.1 MB");
  });

  it("print an error with each cause under it, the way fetch reports a dropped connection", () => {
    const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    const fetchFailed = new TypeError("fetch failed", { cause: reset });
    const error = new Error("GET https://ringsdb.com/api/public/packs/ failed after 1.2 s", { cause: fetchFailed });
    expect(describeError(error)).toBe("GET https://ringsdb.com/api/public/packs/ failed after 1.2 s\n  caused by: fetch failed\n  caused by: read ECONNRESET");
    expect(describeError(Object.assign(new Error("connect refused"), { code: "ECONNREFUSED" }))).toBe("connect refused (ECONNREFUSED)");
    expect(describeError("plain")).toBe("plain");
  });
});

describe("a sync's summary", () => {
  const record = (pin: string, files: [string, string][]): SourceRecord => ({
    id: "ringsdb",
    site: "https://ringsdb.com",
    pin: { kind: "sha256", value: pin },
    fetchedAt: "2026-10-25T00:00:00.000Z",
    files: files.map(([path, sha256]) => ({ path, url: `https://example.test/${path}`, sha256, bytes: 1024 })),
  });

  it("says when nothing changed, and what did when something did", () => {
    const before = record("aaaaaaaaaaaaaaaa", [["raw/a.json", "1"], ["raw/b.json", "2"]]);
    expect(recordChanges(undefined, before)).toBe("2 files, 2.0 KB; first sync");
    expect(recordChanges(before, before)).toBe("2 files, 2.0 KB; pin unchanged");
    const after = record("bbbbbbbbbbbbbbbb", [["raw/a.json", "9"], ["raw/c.json", "3"]]);
    expect(recordChanges(before, after)).toBe("2 files, 2.0 KB; pin aaaaaaaaaaaa -> bbbbbbbbbbbb: 1 added (raw/c.json), 1 removed (raw/b.json), 1 changed (raw/a.json)");
  });
});

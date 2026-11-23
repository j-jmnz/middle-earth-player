import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DATA_DIR } from "../paths.ts";
import { parseLedger } from "../printed/ledger.ts";
import { declaredOrigin, FAN_MADE_PUBLISHERS, SOURCE_PUBLISHERS, sourceOriginProblems } from "./origins.ts";

const sources = (JSON.parse(readFileSync(path.join(DATA_DIR, "sources.json"), "utf8")) as { sources: Record<string, Parameters<typeof sourceOriginProblems>[0][string]> }).sources;

describe("source origins", () => {
  it("records no origin on a source today: every source is official, and the licence gate passes", () => {
    expect(Object.values(sources).filter((record) => record.origin !== undefined)).toEqual([]);
    expect(sourceOriginProblems(sources)).toEqual([]);
    expect(SOURCE_PUBLISHERS).toEqual({});
  });

  it("fails a fan-made source with no licence, no publisher, or an unknown origin", () => {
    expect(sourceOriginProblems({ x: { origin: "fan-made", publisher: "Some Party" } })).toEqual([expect.stringContaining("needs its licence")]);
    expect(sourceOriginProblems({ x: { origin: "fan-made", licence: " ", publisher: "Some Party" } })).toEqual([expect.stringContaining("needs its licence")]);
    expect(sourceOriginProblems({ x: { origin: "fan-made", licence: "permission" } })).toEqual([expect.stringContaining("publisher's name")]);
    expect(sourceOriginProblems({ x: { origin: "fan-made", publisher: "Some Party", licence: "permission" } })).toEqual([]);
    expect(sourceOriginProblems({ x: { origin: "official" }, y: {} })).toEqual([]);
    expect(sourceOriginProblems({ x: { origin: "bootleg" as "fan-made" } })).toHaveLength(1);
  });

  it("declares every publisher with a name, a licence and who stated it, ALeP first", () => {
    expect(Object.keys(FAN_MADE_PUBLISHERS)).toEqual(["alep"]);
    for (const publisher of Object.values(FAN_MADE_PUBLISHERS)) {
      expect(publisher.name).not.toBe("");
      expect(publisher.licence).not.toBe("");
      expect(publisher.statedBy).toMatch(/\d{4}-\d{2}-\d{2}/);
    }
    expect(FAN_MADE_PUBLISHERS.alep.licence).toBe("written permission from the publisher for this app, no commercial use");
  });

  it("copies a declared publisher's licence into its source record, and refuses an undeclared publisher", () => {
    expect(declaredOrigin("ringsdb")).toEqual({});
    const record = declaredOrigin("alep-set", { "alep-set": "alep" });
    expect(record).toEqual({ origin: "fan-made", publisher: "A Long-extended Party", licence: FAN_MADE_PUBLISHERS.alep.licence });
    expect(sourceOriginProblems({ "alep-set": record })).toEqual([]);
    expect(() => declaredOrigin("x", { x: "nobody" })).toThrow("does not declare");
  });
});

describe("ledger entries of a fan-made set", () => {
  const entry = { code: "1", side: "A", printing: "P", scan: { url: "https://x.test/a.jpg", sha256: "0".repeat(64) }, lines: ["x"], inert: [], misprints: [], readBy: "", confirmedBy: null };
  const parse = (extra: object) => parseLedger({ campaign: "t", conventions: [], entries: [{ ...entry, ...extra }] });

  it("takes a declared publisher with its version, and none of them on an official entry", () => {
    expect(parse({}).entries).toHaveLength(1);
    expect(parse({ publisher: "alep", version: "2.0" }).entries[0]?.version).toBe("2.0");
  });

  it("refuses an undeclared publisher, and a publisher without a version or a version without a publisher", () => {
    expect(() => parse({ publisher: "nobody", version: "1" })).toThrow("not declared");
    expect(() => parse({ publisher: "alep" })).toThrow("both");
    expect(() => parse({ version: "1" })).toThrow("both");
  });
});

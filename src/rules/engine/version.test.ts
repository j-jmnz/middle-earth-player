import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { changesReaching, ENGINE_CHANGES, ENGINE_VERSION } from "./version.ts";

const SCENARIOS = path.resolve(import.meta.dirname, "..", "..", "..", "data", "scenarios");

describe("ENGINE_CHANGES (src/rules/engine/version.ts)", () => {
  it("has one entry for each version, ascending, the last being ENGINE_VERSION", () => {
    const versions = ENGINE_CHANGES.map((change) => change.version);
    const first = versions[0] ?? 0;
    expect(versions).toEqual(versions.map((_, at) => first + at));
    expect(versions.at(-1)).toBe(ENGINE_VERSION);
  });

  it("names scenarios that exist and writes one sentence for players", () => {
    const ids = new Set(readdirSync(SCENARIOS).filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, "")));
    for (const change of ENGINE_CHANGES) {
      if (change.scenarios !== "all") for (const id of change.scenarios) expect(ids.has(id), `${change.version}: ${id}`).toBe(true);
      expect(change.note, String(change.version)).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("lists the notes after a version that reach a scenario", () => {
    expect(changesReaching("the-drowned-ruins", 25)).toEqual([ENGINE_CHANGES.at(-1)!.note]);
    expect(changesReaching("the-drowned-ruins", 21)).toHaveLength(3);
    expect(changesReaching("the-oath", ENGINE_VERSION)).toEqual([]);
  });
});

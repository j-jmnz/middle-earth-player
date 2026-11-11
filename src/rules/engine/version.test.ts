import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { changesReaching, ENGINE_CHANGES, ENGINE_CHANGES_SINCE, ENGINE_VERSION, type EngineChange } from "./version.ts";

const SCENARIOS = path.resolve(import.meta.dirname, "..", "..", "..", "data", "scenarios");

describe("ENGINE_CHANGES (src/rules/engine/version.ts)", () => {
  it("has entries only for versions after the baseline up to ENGINE_VERSION, ascending, and one for each bump (none while the version is the baseline)", () => {
    const versions = ENGINE_CHANGES.map((change) => change.version);
    expect(versions).toEqual(versions.toSorted((a, b) => a - b));
    for (const version of versions) {
      expect(version).toBeGreaterThan(ENGINE_CHANGES_SINCE);
      expect(version).toBeLessThanOrEqual(ENGINE_VERSION);
    }
    const distinct = [...new Set(versions)];
    expect(distinct).toEqual(distinct.map((_, at) => ENGINE_CHANGES_SINCE + 1 + at));
    expect(distinct.at(-1) ?? ENGINE_CHANGES_SINCE).toBe(ENGINE_VERSION);
  });

  it("names scenarios that exist and writes one sentence for players", () => {
    const ids = new Set(readdirSync(SCENARIOS).filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, "")));
    for (const change of ENGINE_CHANGES) {
      if (change.scenarios !== "all") for (const id of change.scenarios) expect(ids.has(id), `${change.version}: ${id}`).toBe(true);
      expect(change.note, String(change.version)).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("lists the notes after a version, up to the build's, that reach a scenario, from the list it is given", () => {
    const list: readonly EngineChange[] = [
      { version: 25, scenarios: "all", note: "A." },
      { version: 25, scenarios: ["the-oath"], note: "B." },
      { version: 26, scenarios: ["the-drowned-ruins"], note: "C." },
      { version: ENGINE_VERSION + 1, scenarios: "all", note: "Not yet." },
    ];
    expect(changesReaching("the-oath", 24, list)).toEqual(["A.", "B."]);
    expect(changesReaching("the-drowned-ruins", 24, list)).toEqual(["A.", "C."]);
    expect(changesReaching("the-drowned-ruins", 25, list)).toEqual(["C."]);
    expect(changesReaching("the-oath", ENGINE_VERSION, list)).toEqual([]);
  });

  it("lists nothing for a game dealt before the baseline while no change is recorded", () => {
    if (ENGINE_CHANGES.length === 0) expect(changesReaching("the-oath", 12)).toEqual([]);
  });
});

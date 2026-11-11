import { describe, expect, it } from "vitest";

import { joinNames, reachedScenarios, type GoldenChecks } from "./reach.ts";

const goldens = (...checks: number[][]): GoldenChecks => checks.map((list, at) => ({ name: `g${at}`, checks: list }));

describe("reachedScenarios", () => {
  const changes = [
    { version: 5, scenarios: ["the-oath"], note: "A." },
    { version: 6, scenarios: ["the-ring-goes-south"], note: "B." },
  ];

  it("names the scenarios of ENGINE_CHANGES after the previous release's engine version, and 'all' for an entry that reaches all", () => {
    const base = { previous: new Map(), current: new Map() };
    expect(reachedScenarios({ ...base, previousEngineVersion: 5, engineChanges: changes })).toEqual({ all: false, scenarios: ["the-ring-goes-south"] });
    expect(reachedScenarios({ ...base, previousEngineVersion: 4, engineChanges: [...changes, { version: 7, scenarios: "all", note: "C." }] })).toEqual({ all: true, scenarios: ["the-oath", "the-ring-goes-south"] });
  });

  it("adds the scenarios whose golden checks changed, and skips a new scenario or one whose goldens had no checks at the previous release", () => {
    const reach = reachedScenarios({
      previousEngineVersion: 6,
      engineChanges: changes,
      previous: new Map([["the-oath", goldens([1, 2])], ["helms-deep", goldens([3])], ["lost-in-mirkwood", [{ name: "g0" }]]]),
      current: new Map([["the-oath", goldens([1, 2])], ["helms-deep", goldens([4])], ["lost-in-mirkwood", goldens([9])], ["the-uruk-hai", goldens([5])]]),
    });
    expect(reach).toEqual({ all: false, scenarios: ["helms-deep"] });
  });

  it("joins names for a sentence", () => {
    expect([joinNames([]), joinNames(["A"]), joinNames(["A", "B"]), joinNames(["A", "B", "C"])]).toEqual(["", "A", "A and B", "A, B and C"]);
  });
});

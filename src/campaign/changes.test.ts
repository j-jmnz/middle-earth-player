import { describe, expect, it } from "vitest";

import { CATALOG_VERSION } from "../catalog/version.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";

import { ENGINE_CHANGES, staleChanges, WORLD_CHANGED } from "./changes.ts";

describe("staleChanges", () => {
  const current = { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world: 5 };

  it("lists only the engine lines that reach the scenario: one that names no other scenario hears only the lines for every scenario", () => {
    const forAll = (after: number) => ENGINE_CHANGES.filter((change) => change.version > after && change.scenarios === "all").map((change) => change.note);
    expect(staleChanges({ ...current, engineVersion: ENGINE_VERSION - 1 }, "the-oath", 5)).toEqual(forAll(ENGINE_VERSION - 1));
    expect(staleChanges({ ...current, engineVersion: 12 }, "the-oath", 5)).toEqual(forAll(12));
  });

  it("says when the cards or the scenario changed, and says nothing for a current game", () => {
    expect(staleChanges({ ...current, world: 4 }, "the-oath", 5)).toEqual([WORLD_CHANGED]);
    expect(staleChanges(current, "the-oath", 5)).toEqual([]);
    expect(staleChanges(current, "the-oath", null)).toEqual([]);
  });
});

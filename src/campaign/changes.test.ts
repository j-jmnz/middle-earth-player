import { describe, expect, it } from "vitest";

import { CATALOG_VERSION } from "../catalog/version.ts";
import { ENGINE_CHANGES, ENGINE_VERSION } from "../rules/engine/version.ts";

import { staleChanges, WORLD_CHANGED } from "./changes.ts";

describe("staleChanges", () => {
  const current = { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world: 5 };

  it("lists the engine lines after the game's version that reach its scenario", () => {
    expect(staleChanges({ ...current, engineVersion: ENGINE_VERSION - 1 }, "the-oath", 5)).toEqual([ENGINE_CHANGES.at(-1)!.note]);
    expect(staleChanges({ ...current, engineVersion: 21 }, "the-oath", 5)).toHaveLength(2);
  });

  it("says when the cards or the scenario changed, and says nothing for a current game", () => {
    expect(staleChanges({ ...current, world: 4 }, "the-oath", 5)).toEqual([WORLD_CHANGED]);
    expect(staleChanges(current, "the-oath", 5)).toEqual([]);
    expect(staleChanges(current, "the-oath", null)).toEqual([]);
  });
});

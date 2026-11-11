import { describe, expect, it } from "vitest";

import { CATALOG_VERSION } from "../catalog/version.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";

import { staleChanges, WORLD_CHANGED } from "./changes.ts";

describe("staleChanges", () => {
  const current = { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world: 5 };

  it("lists no engine line while none is recorded: a game on an earlier version is still stale by its version", () => {
    expect(staleChanges({ ...current, engineVersion: ENGINE_VERSION - 1 }, "the-oath", 5)).toEqual([]);
    expect(staleChanges({ ...current, engineVersion: 12 }, "the-oath", 5)).toEqual([]);
  });

  it("says when the cards or the scenario changed, and says nothing for a current game", () => {
    expect(staleChanges({ ...current, world: 4 }, "the-oath", 5)).toEqual([WORLD_CHANGED]);
    expect(staleChanges(current, "the-oath", 5)).toEqual([]);
    expect(staleChanges(current, "the-oath", null)).toEqual([]);
  });
});

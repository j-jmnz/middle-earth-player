// Rules: dcce.island-map, dcce.exploration, dcce.uncharted (data/rules/entries.json); ledger lines 12067:A:1, 12072:A:1, 12073:A:2, 12078:A:1. The Island Map's pure parts: the grid, the neighbors, the reach, the row to the left,
// laying the dealt locations out (counts, the Temple column, the seed), the corners, the marker and the staging area following it.
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, loadTempleWorld, templeTable, type TempleWorld } from "../../../../scripts/temple-scene.ts";
import { blankScenario } from "../../state.ts";
import { dealUnchartedDeck } from "../uncharted/deal.ts";
import { cardAt, cellOf, leftOf, neighbors, prepareMap, revealCorners, setActive, startCells, stagingCells, syncIsland, within } from "./map.ts";
import type { IslandState } from "../uncharted/types.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

const GRID: IslandState = { cells: Array.from({ length: 15 }, (_, at) => `c${at}`) };

describe("the grid", () => {
  it("reads row and column from the cell's place, five columns across", () => {
    expect(cellOf(GRID, "c0")).toEqual({ row: 0, col: 0 });
    expect(cellOf(GRID, "c9")).toEqual({ row: 1, col: 4 });
    expect(cellOf(GRID, "c14")).toEqual({ row: 2, col: 4 });
    expect(cellOf(GRID, "missing")).toBeNull();
    expect(cardAt(GRID, 1, 2)).toBe("c7");
    expect(cardAt(GRID, 3, 0)).toBeNull();
    expect(cardAt(GRID, 0, 5)).toBeNull();
  });

  it("lists the neighbors orthogonally and never diagonally, at an edge fewer", () => {
    expect(neighbors(GRID, "c6")).toEqual(["c1", "c5", "c7", "c11"]);
    expect(neighbors(GRID, "c0")).toEqual(["c1", "c5"]);
    expect(neighbors(GRID, "c14")).toEqual(["c9", "c13"]);
  });

  it("reaches the locations up to a number of steps away over any card, not the location itself", () => {
    expect(within(GRID, "c6", 1).sort()).toEqual(["c1", "c11", "c5", "c7"].sort());
    expect(within(GRID, "c5", 3)).toContain("c8");
    expect(within(GRID, "c5", 3)).not.toContain("c9");
    expect(within(GRID, "c5", 3)).not.toContain("c5");
  });

  it("lists the locations to the left in the row, the nearest first", () => {
    expect(leftOf(GRID, "c8")).toEqual(["c7", "c6", "c5"]);
    expect(leftOf(GRID, "c5")).toEqual([]);
  });
});

describe("laying the map out (12067:A:1)", () => {
  // The fifteen dealt locations: twelve Lost Islands (two of each) and the Temple column's three.
  const DEALT = ["12072", "12072", "12073", "12073", "12074", "12074", "11072", "11072", "11073", "11073", "11074", "11074", "12068", "12069", "12069"];

  function dealt(codes: readonly string[], seed = 1) {
    const ctx = { cards: world.cards };
    const blank = blankScenario({ seatCount: 1, seed, definition: world.definition });
    return dealUnchartedDeck(blank, codes, ctx);
  }

  it("puts the Temple of the Deceived locations in the right-hand column and the others in the first four, covered, in play", () => {
    const state = prepareMap(dealt(DEALT), ["12068", "12069"]);
    const cells = state.uncharted?.island?.cells ?? [];
    expect(cells).toHaveLength(15);
    expect([4, 9, 14].map((at) => state.cards[cells[at] ?? ""]?.code).sort()).toEqual(["12068", "12069", "12069"]);
    expect(cells.filter((_, at) => at % 5 !== 4).map((id) => state.cards[id]?.code).sort()).toEqual(DEALT.slice(0, 12).sort());
    for (const id of cells) expect(state.cards[id]).toMatchObject({ zone: "islandMap", face: "B" });
    expect(state.uncharted?.deck).toEqual([]);
    expect(state.failure).toBeNull();
  });

  it("lays out the same map for the same seed and another for another", () => {
    const codes = (seed: number) => (prepareMap(dealt(DEALT, seed), ["12068", "12069"]).uncharted?.island?.cells ?? []).map((id, at) => `${at}:${prepareMap(dealt(DEALT, seed), ["12068", "12069"]).cards[id]?.code}`).join(",");
    expect(codes(1)).toBe(codes(1));
    expect(new Set([1, 2, 3, 4, 5].map(codes)).size).toBeGreaterThan(1);
  });

  it("refuses to play with the wrong number of locations: the scenario was not dealt as it should be", () => {
    expect(prepareMap(dealt(DEALT.slice(1)), ["12068", "12069"]).failure).toMatch(/needs 15 locations/);
    expect(prepareMap(dealt(DEALT), ["12068"]).failure).toMatch(/needs 15 locations/);
  });

  it("flips the two left-hand corners and offers them as the starting location until one is active", () => {
    const laid = prepareMap(dealt(DEALT), ["12068", "12069"]);
    const cells = laid.uncharted?.island?.cells ?? [];
    const flipped = revealCorners(laid);
    expect(cells.filter((id) => flipped.cards[id]?.face === "A")).toEqual([cells[0], cells[10]]);
    expect(startCells(flipped)).toEqual([cells[0], cells[10]]);
    expect(startCells(laid)).toEqual([]);
    const active = setActive(flipped, cells[10]);
    expect(active.activeLocation).toBe(cells[10]);
    expect(active.cards[cells[10] ?? ""]?.zone).toBe("activeLocation");
    // Once a location is active the choice is over.
    expect(startCells(active)).toEqual([]);
    expect(setActive(active, "not a cell")).toBe(active);
  });
});

describe("the staging area follows the marker", () => {
  const MAP = ["12072", "12073", "?12074", "?11072", "?12068", "?11073", "11074", "?12072", "?12073", "?12069", "12074", "?11072", "?11073", "?11074", "?12069"];

  it("moves the neighbors into the staging area and the rest onto the map, and settles to the same state", () => {
    const made = templeTable(world, { map: MAP, at: 6 });
    const again = syncIsland(made.state, made.ctx);
    expect(again).toBe(made.state);
    expect(stagingCells(made.state).sort()).toEqual([1, 5, 7, 11].map((at) => made.cells[at]!).sort());
    // The marker moves; the cards follow it.
    const moved = syncIsland(setActive(made.state, made.cells[7]), made.ctx);
    expect(made.cells.flatMap((id, at) => (moved.cards[id]?.zone === "staging" ? [at] : []))).toEqual([2, 6, 8, 12]);
    expect(moved.staging.filter((id) => made.cells.includes(id)).length).toBe(4);
    expect(CODES.cursedTemple).toBe("11074");
  });

  it("leaves a location that has left the map alone", () => {
    const made = templeTable(world, { map: MAP, at: 6 });
    const gone = { ...made.state, cards: { ...made.state.cards, [made.cells[1]!]: { ...made.state.cards[made.cells[1]!]!, zone: "victory" as const } } };
    expect(syncIsland(gone, made.ctx).cards[made.cells[1]!]?.zone).toBe("victory");
  });
});

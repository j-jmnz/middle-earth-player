// Rules: dcce.island-map, dcce.exploration, dcce.uncharted, rr.travel, rr.active-location, rr.explored (data/rules/entries.json); ledger lines 12067:A:1, 12067:B:1, 12067:B:2, 12072:A:1, 12073:A:2, 12074:A:1. The Island
// Map and Exploration: the grid, the active location marked where it lies, the locations next to it standing in the staging area, a full location that stays in play, traveling from the active location
// once it is full, and the reach of Winding Caverns (test/scenarios/temple-of-the-deceived/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { islandMayTravel, islandReach } from "../rules/families/island/travel.ts";
import { cellOf, neighbors, stagingCells, within } from "../rules/families/island/map.ts";
import { placeQuestProgress, stagingThreat } from "../rules/quest/quest.ts";
import { legalIntents, legalTargets } from "../rules/engine/legal.ts";
import { reduce } from "../rules/engine/reduce.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { finish, send, start, templeTable, loadTempleWorld, type TempleLayout, type TempleWorld } from "../../test/scenarios/temple-of-the-deceived/scene.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

// The map of a table: row by row, the first four columns Lost Islands, the last the Temple column. A code with "?" lies Uncharted side up. Index 6 is row 1, column 1.
const MAP = [
  "12072", "12073", "12074", "11072", "?12068",
  "?11073", "11074", "12072", "?12073", "?12069",
  "?12074", "?11072", "?11073", "?11074", "?12069",
] as const;

function make(layout: TempleLayout = {}) {
  return templeTable(world, { map: MAP, at: 6, phase: "Travel", engaged: [{ code: "mild", seat: 0 }], ...layout });
}
type Table = ReturnType<typeof make>;

const codeAt = (made: Table, state: ScenarioState, index: number): string => state.cards[made.cells[index] ?? ""]?.code ?? "";
const zoneAt = (made: Table, state: ScenarioState, index: number): string => state.cards[made.cells[index] ?? ""]?.zone ?? "";
const inStaging = (made: Table, state: ScenarioState): number[] => made.cells.flatMap((id, at) => (state.cards[id]?.zone === "staging" ? [at] : []));

describe("the Island Map (dcce.island-map, dcce.exploration)", () => {
  it("lays fifteen locations in three rows of five, the Temple of the Deceived locations in the right-hand column", () => {
    const made = make();
    expect(made.cells).toHaveLength(15);
    expect(made.cells.map((id) => made.state.uncharted?.island?.cells.indexOf(id))).toEqual(Array.from({ length: 15 }, (_, at) => at));
    expect([4, 9, 14].map((at) => codeAt(made, made.state, at))).toEqual(["12068", "12069", "12069"]);
    expect(cellOf(made.state.uncharted!.island!, made.cells[7]!)).toEqual({ row: 1, col: 2 });
  });

  it("keeps the active location in its place and stands the locations next to it, not diagonally, in the staging area (dcce.exploration)", () => {
    const made = make();
    expect(made.state.activeLocation).toBe(made.cells[6]);
    expect(zoneAt(made, made.state, 6)).toBe("activeLocation");
    expect(inStaging(made, made.state)).toEqual([1, 5, 7, 11]);
    expect(made.state.staging.filter((id) => made.cells.includes(id)).sort()).toEqual([1, 5, 7, 11].map((at) => made.cells[at]!).sort());
    // Every other location is in play on the map, not in the staging area.
    for (const at of [0, 2, 3, 4, 8, 9, 10, 12, 13, 14]) expect(zoneAt(made, made.state, at)).toBe("islandMap");
    expect(neighbors(made.state.uncharted!.island!, made.cells[0]!)).toEqual([made.cells[1], made.cells[5]]);
  });

  it("counts the Threat of the locations next to the active one, a Lost Island at 2, and not the ones outside the staging area", () => {
    const made = make();
    // The four neighbors of row 1, column 1: Winding Caverns (2), a Lost Island (2), Jagged Cliffs (4) and a Lost Island (2); Cursed Temple is the active one and adds nothing.
    expect(stagingThreat(made.state, made.ctx.cards)).toBe(2 + 2 + 4 + 2);
    // With Jagged Cliffs active its right-hand neighbor is out: Jungle Path (3), Cursed Temple (1) and a Lost Island (2) are left.
    const next = make({ at: 7 });
    expect(stagingThreat(next.state, next.ctx.cards)).toBe(3 + 1 + 2);
  });

  it("does not explore a location that has progress equal to its quest points: it remains in play (dcce.exploration)", () => {
    const made = make({ cellProgress: [[6, 1]] });
    const quest = made.state.cards[made.cells[6]!]!;
    expect(world.cards.get(quest.code)?.questPoints).toBeGreaterThan(1);
    const points = world.cards.get(quest.code)?.questPoints ?? 0;
    const steps: never[] = [];
    const full = placeQuestProgress(made.state, points + 3, world.cards, steps, () => true, true);
    const active = full.cards[made.cells[6]!]!;
    expect(active.progress).toBe(points);
    expect(active.zone).toBe("activeLocation");
    expect(full.victory).toEqual([]);
    expect(full.encounterDiscard).toEqual([]);
    expect(full.uncharted?.deck).toEqual([]);
  });
});

describe("traveling on the map (dcce.exploration)", () => {
  it("offers no travel until the active location has progress equal to its quest points", () => {
    const empty = make();
    expect(islandMayTravel(empty.state, empty.ctx.cards)).toBe(false);
    expect(legalIntents(empty.state, empty.ctx).some((intent) => intent.type === "Travel")).toBe(false);
    expect(legalIntents(empty.state, empty.ctx).some((intent) => intent.type === "DeclineTravel")).toBe(true);
    const points = world.cards.get(codeAt(empty, empty.state, 6))?.questPoints ?? 0;
    const partly = make({ cellProgress: [[6, points - 1]] });
    expect(islandMayTravel(partly.state, partly.ctx.cards)).toBe(false);
    const full = make({ cellProgress: [[6, points]] });
    expect(islandMayTravel(full.state, full.ctx.cards)).toBe(true);
    expect([...legalTargets(full.state, { type: "Travel" }, full.ctx)].sort()).toEqual([1, 5, 7, 11].map((at) => full.cells[at]!).sort());
  });

  it("takes all the progress off the location the players travel from, which stays where it is, and the staging area follows the new active location", () => {
    const points = world.cards.get("11074")?.questPoints ?? 0;
    const made = make({ cellProgress: [[6, points]] });
    const run = finish(send(start(made.state), { type: "Travel", locationId: made.cells[7]! }, made.ctx), made.ctx);
    const state = run.state;
    expect(state.activeLocation).toBe(made.cells[7]);
    expect(state.cards[made.cells[6]!]?.progress).toBe(0);
    expect(state.cards[made.cells[6]!]?.zone).toBe("staging");
    expect(state.cards[made.cells[7]!]?.zone).toBe("activeLocation");
    // Jagged Cliffs is the active location now: the location to its right (8) is shut out of the staging area (12072:A:1).
    expect(inStaging(made, state)).toEqual([2, 6, 12]);
    expect(zoneAt(made, state, 8)).toBe("islandMap");
    // Nothing was discarded, explored or put in the victory display.
    expect(state.encounterDiscard).toEqual([]);
    expect(state.victory).toEqual([]);
    expect(state.uncharted?.island?.moved).toEqual({ from: made.cells[6], to: made.cells[7] });
    expect(run.steps.some((step) => step.kind === "progress" && step.targetId === made.cells[6] && step.amount === -points)).toBe(true);
  });

  it("lets the players return to a location they explored, and flips a Lost Island they travel to (dcce.uncharted)", () => {
    const points = world.cards.get("11074")?.questPoints ?? 0;
    const made = make({ cellProgress: [[6, points]] });
    // Row 1, column 0 lies Uncharted side up: traveling there flips it over.
    const run = finish(send(start(made.state), { type: "Travel", locationId: made.cells[5]! }, made.ctx), made.ctx);
    expect(run.state.cards[made.cells[5]!]?.face).toBe("A");
    expect(run.state.activeLocation).toBe(made.cells[5]);
    expect(run.state.cards[made.cells[5]!]?.progress).toBe(0);
  });

  it("does not let the players travel to a location that is not next to the active one, or one the rules shut out", () => {
    const points = world.cards.get("11074")?.questPoints ?? 0;
    const made = make({ cellProgress: [[6, points]] });
    const far = reduce(made.state, { type: "Travel", locationId: made.cells[8]! }, made.ctx);
    expect(far).toMatchObject({ ok: false, reason: "That location is not in staging" });
    const diagonal = reduce(made.state, { type: "Travel", locationId: made.cells[2]! }, made.ctx);
    expect(diagonal.ok).toBe(false);
  });
});

describe("Jagged Cliffs and Jungle Path shut a neighbor out of the staging area (12072:A:1, 12074:A:1)", () => {
  it("leaves the location to the right of Jagged Cliffs out of the staging area while it is the active location", () => {
    const made = templeTable(world, { map: MAP, at: 7, phase: "Travel", engaged: [{ code: "mild", seat: 0 }] });
    expect(codeAt(made, made.state, 7)).toBe("12072");
    // Row 1, column 2: above (2), left (6), below (12) stand in the staging area; the one to the right (8) does not.
    expect(inStaging(made, made.state)).toEqual([2, 6, 12]);
    expect(zoneAt(made, made.state, 8)).toBe("islandMap");
    expect(stagingCells(made.state)).toHaveLength(3);
  });

  it("leaves the locations above and below Jungle Path out of the staging area while it is the active location", () => {
    const map = [...MAP] as string[];
    map[7] = "12074";
    const made = templeTable(world, { map, at: 7, phase: "Travel", engaged: [{ code: "mild", seat: 0 }] });
    expect(inStaging(made, made.state)).toEqual([6, 8]);
  });
});

describe("Winding Caverns (12073:A:2)", () => {
  it("lets the players travel up to 3 locations away, still paying the Travel cost there", () => {
    const map = [...MAP] as string[];
    map[6] = "12073";
    const points = world.cards.get("12073")?.questPoints ?? 0;
    const made = templeTable(world, { map, at: 6, phase: "Travel", engaged: [{ code: "mild", seat: 0 }], cellProgress: [[6, points]] });
    const reach = islandReach(made.state);
    expect(reach.every((id) => within(made.state.uncharted!.island!, made.cells[6]!, 3).includes(id))).toBe(true);
    // The Temple column, 3 steps away at most from column 1? Row 1 column 1 to column 4 is 3 steps: reachable, but they cannot pay the Gate Key's cost.
    const targets = legalTargets(made.state, { type: "Travel" }, made.ctx);
    expect(targets).toContain(made.cells[8]);
    expect(targets).toContain(made.cells[3]);
    expect(targets).not.toContain(made.cells[9]);
    expect(targets).not.toContain(made.cells[14]);
  });
});

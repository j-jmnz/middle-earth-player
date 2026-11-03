// Rules: dcce.gaining-xp, dcce.hard-expert (data/rules/entries.json). The XP lines of the campaign card's Resolution (11179:B:2 to B:6), each run on a table that makes that line true against a
// baseline that makes every other line false: threat over 40, nothing in the victory display, no resource on the campaign card, one surviving player (1 XP).
import { beforeAll, describe, expect, it } from "vitest";

import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { CODES, fateTable, loadFateWorld, type FateLayout, type FateWorld } from "../../../../test/scenarios/the-fate-of-numenor/scene.ts";

let world: FateWorld;

beforeAll(async () => {
  world = await loadFateWorld();
});

// The XP the Resolution adds up for the table `layout` describes, won.
function xpOf(layout: FateLayout = {}, tweak: (state: ScenarioState) => ScenarioState = (state) => state): number {
  const made = fateTable(world, { stage: "11026", threat: [45, 26], campaign: true, ...layout });
  const won: ScenarioState = tweak({ ...made.state, window: null, stageCleared: true, resolution: world.definition.resolution });
  return resolutionResult(openResolution(won, made.ctx))?.xp ?? 0;
}

describe("the campaign card's XP list (11179:B:1 to 11179:B:6)", () => {
  it("the baseline gains 1 XP for the one surviving player and nothing else (11179:B:2)", () => {
    expect(xpOf()).toBe(1);
  });

  it("gains 1 XP for each surviving player, and none for a player who is eliminated (11179:B:2)", () => {
    expect(xpOf({ seats: 2, threat: [45, 45] })).toBe(2);
    // The second player is out of the game: one survivor.
    const out = (state: ScenarioState): ScenarioState => ({ ...state, seats: [state.seats[0]!, { ...state.seats[1]!, eliminated: true }] });
    expect(xpOf({ seats: 2, threat: [45, 50] }, out)).toBe(1);
  });

  it("gains 1 XP for each Lush Jungle and Drowned Graves in the victory display, and nothing for another double-sided location (11179:B:3)", () => {
    expect(xpOf({ victory: [CODES.lushJungle] })).toBe(2);
    expect(xpOf({ victory: [CODES.drownedGraves] })).toBe(2);
    expect(xpOf({ victory: [CODES.lushJungle, CODES.drownedGraves, CODES.lushJungle] })).toBe(4);
    expect(xpOf({ victory: [CODES.forbiddenCoast, CODES.floodedRuins, CODES.cursedTemple, CODES.shrine] })).toBe(1);
  });

  it("gains 1 XP for each resource on the campaign card, to a maximum of 3 XP (11179:B:4)", () => {
    expect(xpOf({ campaignResources: 1 })).toBe(2);
    expect(xpOf({ campaignResources: 3 })).toBe(4);
    expect(xpOf({ campaignResources: 5 })).toBe(4);
  });

  it("gains 1 XP if each surviving player's threat is 40 or less (11179:B:5)", () => {
    expect(xpOf({ threat: [40, 26] })).toBe(2);
    expect(xpOf({ threat: [41, 26] })).toBe(1);
    expect(xpOf({ seats: 2, threat: [40, 41] })).toBe(2);
    expect(xpOf({ seats: 2, threat: [40, 39] })).toBe(3);
    // An eliminated player's threat does not count against it.
    const out = (state: ScenarioState): ScenarioState => ({ ...state, seats: [state.seats[0]!, { ...state.seats[1]!, eliminated: true }] });
    expect(xpOf({ seats: 2, threat: [40, 50] }, out)).toBe(2);
  });

  it("gains -1 XP if Ominous Fate is in the victory display, not for more than one copy (11179:B:6)", () => {
    expect(xpOf({ victory: [CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.lushJungle] })).toBe(1);
  });
});

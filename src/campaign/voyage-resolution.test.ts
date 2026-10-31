// Rules: dcce.gaining-xp (data/rules/entries.json). The XP lines of the campaign card's Resolution (11171:B:4, B:7, B:8, B:9, B:10), each run on a table whose victory display
// makes that line true, against a baseline that makes every other line false: off-course, a Ship enemy in play, one surviving player (1 XP).
import { beforeAll, describe, expect, it } from "vitest";

import { openResolution, resolutionResult } from "../rules/resolution.ts";
import type { ScenarioState } from "../rules/state.ts";
import { CORSAIR_WARSHIP, CROWLEY, OMINOUS_FATE, SCOUTING_SHIP, THUNDERSTRUCK, loadVoyageWorld, voyageTable, type VoyageLayout, type VoyageWorld } from "../../scripts/voyage-scene.ts";

let world: VoyageWorld;

beforeAll(async () => {
  world = await loadVoyageWorld();
});

// The XP the Resolution adds up for the table `layout` describes, won.
function xpOf(layout: VoyageLayout = {}): number {
  const made = voyageTable(world, { heading: "Cloud", ships: [{ code: "11080", seat: 0 }], staging: [SCOUTING_SHIP], ...layout });
  const won: ScenarioState = { ...made.state, window: null, stageCleared: true, resolution: world.definition.resolution };
  return resolutionResult(openResolution(won, made.ctx))?.xp ?? 0;
}

// Quest cards 2B of the four stage 2 cards: Into the Storm, Cursed Mists, Calphon's Divination, The Star's Guidance.
const STAGE_TWOS = ["11017", "11018", "11019", "11020"];

describe("the campaign card's XP list (11171:B:3 to 11171:B:10)", () => {
  it("the baseline gains 1 XP for the one surviving player and nothing else (11171:B:3)", () => {
    expect(xpOf()).toBe(1);
  });

  it("gains 1 XP if 4 stage 2B quest cards are in the victory display, and not for 3 (11171:B:4)", () => {
    expect(xpOf({ victory: STAGE_TWOS })).toBe(2);
    expect(xpOf({ victory: STAGE_TWOS.slice(0, 3) })).toBe(1);
  });

  it("gains 1 XP for each Corsair Warship in the victory display (11171:B:7)", () => {
    expect(xpOf({ victory: [CORSAIR_WARSHIP] })).toBe(2);
    expect(xpOf({ victory: [CORSAIR_WARSHIP, CORSAIR_WARSHIP] })).toBe(3);
  });

  it("gains 1 XP if Crowley is in the victory display (11171:B:8)", () => {
    expect(xpOf({ victory: [CROWLEY] })).toBe(2);
  });

  it("gains 2 XP if Thunderstruck is in the victory display (11171:B:9)", () => {
    expect(xpOf({ victory: [THUNDERSTRUCK] })).toBe(3);
  });

  it("gains -1 XP if Ominous Fate is in the victory display (11171:B:10)", () => {
    expect(xpOf({ victory: [OMINOUS_FATE] })).toBe(0);
    expect(xpOf({ victory: [OMINOUS_FATE, THUNDERSTRUCK, CROWLEY] })).toBe(3);
  });
});

// Rules: dcce.gaining-xp, dcce.stormcallers-area, dcce.heading (data/rules/entries.json). The XP lines of the campaign card's Resolution (11191:B:2 to 11191:B:9), each run on a table that makes that line true
// against a baseline that makes every other line false: off-course, the players beyond stage 2B, the Stormcaller alive, a damaged hero, nothing in the victory display, one surviving player (1 XP).
import { beforeAll, describe, expect, it } from "vitest";

import { openResolution, resolutionResult } from "../rules/setup/resolution.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { CODES, flightTable, loadFlightWorld, type FlightLayout, type FlightWorld } from "../../scripts/stormcaller-scene.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

const BASE: FlightLayout = { stage: "12014", heading: "Cloud", campaign: true, campaignSide: true, heroDamage: 1 };

// The XP the Resolution writes for the table `layout` describes, won.
function xpOf(layout: FlightLayout = {}, tweak: (state: ScenarioState) => ScenarioState = (state) => state): number {
  const made = flightTable(world, { ...BASE, ...layout });
  const won: ScenarioState = tweak({ ...made.state, window: null, stageCleared: true, resolution: world.definition.resolution });
  return resolutionResult(openResolution(won, made.ctx))?.xp ?? 0;
}
const out = (state: ScenarioState): ScenarioState => ({ ...state, seats: [state.seats[0]!, { ...state.seats[1]!, eliminated: true }] });

describe("the campaign card's XP list (11191:B:2 to 11191:B:9)", () => {
  it("the baseline gains 1 XP for the one surviving player and nothing else (B:2)", () => {
    expect(xpOf()).toBe(1);
  });

  it("gains 1 XP for each surviving player, and none for a player who is eliminated (B:2)", () => {
    expect(xpOf({ seats: 2 })).toBe(2);
    expect(xpOf({ seats: 2 }, out)).toBe(1);
  });

  it("gains 1 XP if the players ended the game on-course, the Sun setting only (B:3)", () => {
    expect(xpOf({ heading: "Sun" })).toBe(2);
    expect(xpOf({ heading: "Cloud" })).toBe(1);
    expect(xpOf({ heading: "Storm" })).toBe(1);
  });

  it("gains 1 XP if the players ended the game on stage 2B (B:4)", () => {
    expect(xpOf({ stage: "12013" })).toBe(2);
    expect(xpOf({ stage: "12012" })).toBe(1);
    expect(xpOf({ stage: "12015" })).toBe(1);
  });

  it("gains 2 XP if the Stormcaller is in the victory display, whichever side it shows (B:5)", () => {
    expect(xpOf({ victory: [CODES.stormcaller] })).toBe(3);
    expect(xpOf({ victory: [CODES.stormcaller, CODES.stormcaller] })).toBe(3);
  });

  it("gains 1 XP if Crowley is in the victory display, not for more than one (B:6)", () => {
    expect(xpOf({ victory: [CODES.crowley] })).toBe(2);
    expect(xpOf({ victory: [CODES.crowley, CODES.crowley] })).toBe(2);
  });

  it("gains 2 XP if Thunderstruck is in the victory display (B:7)", () => {
    expect(xpOf({ victory: [CODES.thunderstruck] })).toBe(3);
    expect(xpOf({ victory: [CODES.thunderstruck, CODES.crowley] })).toBe(4);
  });

  it("gains 1 XP if each hero has no damage on it (B:8)", () => {
    expect(xpOf({ heroDamage: 0 })).toBe(2);
    expect(xpOf({ heroDamage: 2 })).toBe(1);
  });

  it("gains -1 XP if Ominous Fate is in the victory display, not for more than one copy (B:9)", () => {
    expect(xpOf({ victory: [CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.thunderstruck] })).toBe(2);
  });

  it("adds up a win on stage 2B, on-course, with the Stormcaller destroyed and no damage: 1 + 1 + 1 + 2 + 1", () => {
    expect(xpOf({ stage: "12013", heading: "Sun", victory: [CODES.stormcaller], heroDamage: 0 })).toBe(6);
  });
});

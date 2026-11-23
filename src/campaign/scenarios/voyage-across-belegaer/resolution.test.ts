// Rules: dcce.gaining-xp, rr.campaign-pool, dcce.heading, rr.in-play-and-out-of-play (data/rules/entries.json). The lines of the campaign card's Resolution (11171:B:1, B:4 to B:10), each run
// on a table that makes that line true, against a baseline that makes every other line false: off-course, a Ship enemy in play, one surviving player (1 XP). The tests of B:1, B:5 and B:6
// run again with the records of their line left out of the Resolution (`withoutLine`, test/harness/card-spec.ts) and show the result differs.
import { beforeAll, describe, expect, it } from "vitest";

import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ResolutionLog } from "../../../rules/core/campaign-state.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { scenarioDefinition } from "../../../catalog/scenario-data.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { CORSAIR_WARSHIP, CROWLEY, OMINOUS_FATE, SCOUTING_SHIP, THUNDERSTRUCK, campaign, dealt, loadVoyageWorld, voyageTable, type VoyageLayout, type VoyageWorld } from "../../../../test/scenarios/voyage-across-belegaer/scene.ts";

let world: VoyageWorld;

beforeAll(async () => {
  world = await loadVoyageWorld();
});

// The XP the Resolution adds up for the table `layout` describes, won.
function xpOf(layout: VoyageLayout = {}): number {
  return logOf(layout)?.xp ?? 0;
}

// The Resolution's log for the table `layout` describes, won; `without` leaves the records of that ledger line out of the Resolution.
function logOf(layout: VoyageLayout = {}, without?: string): ResolutionLog | null {
  const made = voyageTable(world, { heading: "Cloud", ships: [{ code: "11080", seat: 0 }], staging: [SCOUTING_SHIP], ...layout });
  const resolution = without ? scenarioDefinition(dealt, campaign, withoutLine(EFFECTS, without)).resolution : world.definition.resolution;
  const won: ScenarioState = { ...made.state, window: null, stageCleared: true, resolution };
  return resolutionResult(openResolution(won, made.ctx));
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
    // Two copies cost it once.
    expect(xpOf({ victory: [OMINOUS_FATE, OMINOUS_FATE] })).toBe(0);
  });

  it("11171:B:1 adds Ominous Fate to the Campaign Pool, with no choice", () => {
    expect(logOf()?.earned.map((item) => item.code)).toEqual(["11176"]);
    expect(logOf({}, "11171:B:1")?.earned.map((item) => item.code)).toEqual([]);
  });

  it("11171:B:5 gains 1 XP if the game ended on-course (Sun), not on another heading or with no Heading card", () => {
    expect(xpOf({ heading: "Sun" })).toBe(2);
    expect(xpOf({ heading: "Rain" })).toBe(1);
    expect(xpOf({ heading: undefined })).toBe(1);
    expect(logOf({ heading: "Sun" }, "11171:B:5")?.xp).toBe(1);
  });

  it("11171:B:6 gains 1 XP if no Ship enemies are in play: one in the staging area or engaged counts, one out of play and the ship-objectives do not", () => {
    expect(xpOf({ staging: [] })).toBe(2);
    // A Ship enemy engaged with a player is in play.
    expect(xpOf({ staging: [], engaged: [{ code: SCOUTING_SHIP, seat: 0 }] })).toBe(1);
    // A non-Ship enemy in play, and a Ship enemy in the encounter discard pile, do not stop it.
    expect(xpOf({ staging: ["raider"], discard: [SCOUTING_SHIP] })).toBe(2);
    expect(logOf({ staging: [] }, "11171:B:6")?.xp).toBe(1);
  });
});

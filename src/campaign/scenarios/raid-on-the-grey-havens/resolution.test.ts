// Rules: dcce.gaining-xp, dcce.hard-expert, dcce.aflame (data/rules/entries.json). The XP lines of the campaign card's Resolution (11182:B:3 to 11182:B:10), each run on a table that makes that line true against a
// baseline that makes every other line false: an enemy in play, threat over 40, three cards underneath The Havens Burn, nothing in the victory display, one surviving player (1 XP). And the cards the Resolution earns
// (11182:B:1, 11182:B:2).
import { beforeAll, describe, expect, it } from "vitest";

import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { CODES, idOf, loadRaidWorld, raidTable, type RaidLayout, type RaidWorld } from "../../../../test/scenarios/raid-on-the-grey-havens/scene.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const BASE: RaidLayout = { stage: "11037", threat: [45, 26], campaign: true, staging: ["f3"], under: [CODES.piers, CODES.pillaged, CODES.whiteShip] };

// The log the Resolution writes for the table `layout` describes, won.
function resolved(layout: RaidLayout = {}, tweak: (state: ScenarioState) => ScenarioState = (state) => state) {
  const made = raidTable(world, { ...BASE, ...layout });
  const won: ScenarioState = tweak({ ...made.state, window: null, stageCleared: true, resolution: world.definition.resolution });
  return { made, state: openResolution(won, made.ctx) };
}
const xpOf = (layout: RaidLayout = {}, tweak?: (state: ScenarioState) => ScenarioState): number => resolutionResult(resolved(layout, tweak).state)?.xp ?? 0;
const out = (state: ScenarioState): ScenarioState => ({ ...state, seats: [state.seats[0]!, { ...state.seats[1]!, eliminated: true }] });

describe("the campaign card's XP list (11182:B:3 to 11182:B:10)", () => {
  it("the baseline gains 1 XP for the one surviving player and nothing else (B:4)", () => {
    expect(xpOf()).toBe(1);
  });

  it("gains 1 XP for each surviving player, and none for a player who is eliminated (B:4)", () => {
    expect(xpOf({ seats: 2, threat: [45, 45] })).toBe(2);
    expect(xpOf({ seats: 2, threat: [45, 50] }, out)).toBe(1);
  });

  it("gains 1 XP if 2 or fewer cards are underneath The Havens Burn, 2 XP instead if none are (B:5)", () => {
    expect(xpOf({ under: [CODES.piers, CODES.pillaged, CODES.whiteShip] })).toBe(1);
    expect(xpOf({ under: [CODES.piers, CODES.pillaged] })).toBe(2);
    expect(xpOf({ under: [CODES.piers] })).toBe(2);
    expect(xpOf({ under: [] })).toBe(3);
  });

  it("gains 1 XP for each Elven Wave-runner in the victory display, and nothing for another card there (B:6)", () => {
    expect(xpOf({ victory: [CODES.waveRunner] })).toBe(2);
    expect(xpOf({ victory: [CODES.waveRunner, CODES.waveRunner] })).toBe(3);
    expect(xpOf({ victory: [CODES.piers, CODES.sahir] })).toBe(1);
  });

  it("gains 1 XP if Na'asiyah is in the victory display, not for more than one (B:7)", () => {
    expect(xpOf({ victory: [CODES.naasiyah] })).toBe(2);
    expect(xpOf({ victory: [CODES.naasiyah, CODES.naasiyah] })).toBe(2);
  });

  it("gains 1 XP if no enemies are in play, engaged or in the staging area (B:8)", () => {
    expect(xpOf({ staging: [] })).toBe(2);
    expect(xpOf({ staging: [], engaged: [{ code: "f3", seat: 0 }] })).toBe(1);
    // A card in the victory display is not in play.
    expect(xpOf({ staging: [], victory: [CODES.sahir] })).toBe(2);
  });

  it("gains 1 XP if each surviving player's threat is 40 or less (B:9)", () => {
    expect(xpOf({ threat: [40, 26] })).toBe(2);
    expect(xpOf({ threat: [41, 26] })).toBe(1);
    expect(xpOf({ seats: 2, threat: [40, 41] })).toBe(2);
    expect(xpOf({ seats: 2, threat: [40, 39] })).toBe(3);
    expect(xpOf({ seats: 2, threat: [40, 50] }, out)).toBe(2);
  });

  it("gains -1 XP if Ominous Fate is in the victory display, not for more than one copy (B:10)", () => {
    expect(xpOf({ victory: [CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.waveRunner] })).toBe(1);
  });
});

describe("the cards the Resolution earns (11182:B:1, 11182:B:2)", () => {
  it("adds the Galdor's Counsel chosen at the Setup to the Campaign Pool for the seat that chose it, wherever the copy is, the victory display after it was played too (B:2)", () => {
    // Seat 0 chose Leadership and kept it in hand; seat 1 chose Tactics and played it, so it is in the victory display.
    const run = resolved({ seats: 2, threat: [45, 45], hand: [CODES.counselLeadership], victory: [CODES.counselTactics], chosen: [[CODES.counselLeadership, 0], [CODES.counselTactics, 1]] });
    expect(resolutionResult(run.state)?.earned.map((item) => [item.code, item.seat])).toEqual([[CODES.counselLeadership, 0], [CODES.counselTactics, 1]]);
    // A game whose Setup chose none earns none, whatever copies are in it.
    expect(resolutionResult(resolved({ seats: 2, victory: [CODES.counselTactics] }).state)?.earned).toEqual([]);
    expect(resolutionResult(resolved().state)?.earned).toEqual([]);
  });

  it("has the first player choose Parrying Cutlass or Throwing Axe and the hero it goes on, when Graxar is in the victory display (B:1)", () => {
    const withGraxar = resolved({ victory: [CODES.graxar] }).state;
    expect(withGraxar.window).toMatchObject({ kind: "resolution", seat: 0 });
    const options = withGraxar.resolutionAt >= 0 && withGraxar.window?.kind === "resolution" ? [CODES.cutlass, CODES.axe].flatMap((code) => ["dh1", "dh2"].map((hero) => `${code}>${idOf(withGraxar, hero)}`)) : [];
    expect(options).toHaveLength(4);
    const without = resolved({}).state;
    expect(without.window).toBeNull();
    expect(resolutionResult(without)?.earned).toEqual([]);
  });

  it("lets the first player give the weapon to a hero of any seat, and earns it for the seat that hero is controlled by (B:1)", async () => {
    const { applyResolution, resolutionIntents } = await import("../../../rules/setup/resolution.ts");
    const run = resolved({ seats: 2, threat: [45, 45], victory: [CODES.graxar] });
    const intents = resolutionIntents(run.state, run.made.ctx).map((intent) => (intent.type === "ChooseResolution" ? intent.optionId : ""));
    const second = idOf(run.state, "dh3");
    expect(intents).toContain(`${CODES.axe}>${second}`);
    expect(intents).toContain(`${CODES.cutlass}>${run.made.hero}`);
    const done = applyResolution(run.state, `${CODES.axe}>${second}`);
    expect(resolutionResult(openResolution(done, run.made.ctx))?.earned).toEqual([expect.objectContaining({ code: CODES.axe, to: "hero", seat: 1, hero: "dh3" })]);
  });
});

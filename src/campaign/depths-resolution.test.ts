// Rules: dcce.gaining-xp, dcce.hard-expert, dcce.campaign-mode, dcce.scalable-upgradable (data/rules/entries.json). The XP lines of the campaign card's Resolution (11194:B:3 to 11194:B:9), each run on a table that makes
// that line true against a baseline that makes every other line false: Captain Sahír and Na'asiyah with 4 resources, no Sea Serpent, a damaged hero, threat over 40, Ominous Fate not in the victory display, one surviving
// player (1 XP). And the card the Resolution lets the players keep (11194:B:1).
import { beforeAll, describe, expect, it } from "vitest";

import { applyResolution, openResolution, resolutionIntents, resolutionResult } from "../rules/resolution.ts";
import type { ScenarioState } from "../rules/state.ts";
import { CODES, depthsTable, idOf, loadDepthsWorld, type DepthsLayout, type DepthsWorld } from "../../scripts/depths-scene.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

// Captain Sahír (objective ally side) and Na'asiyah are in play with 4 resources each; a hero is damaged; the threat is over 40.
const BASE: DepthsLayout = { stage: "12041", threat: [45, 26], campaign: true, allies: true, damage: [["dh1", 1]] };

// The log the Resolution writes for the table `layout` describes, won, the offer of Come Together refused.
function resolved(layout: DepthsLayout = {}, tweak: (state: ScenarioState) => ScenarioState = (state) => state, choice = "skip") {
  const made = depthsTable(world, { ...BASE, ...layout });
  const tokens = (state: ScenarioState, code: string, resources: number): ScenarioState => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, card.code === code ? { ...card, resources } : card])) });
  const prepared = tokens(tokens(made.state, CODES.sahirAlly, 4), CODES.naasiyahAlly, 4);
  const won: ScenarioState = tweak({ ...prepared, window: null, stageCleared: true, resolution: world.definition.resolution });
  let state = openResolution(won, made.ctx);
  for (let guard = 0; guard < 4 && state.window?.kind === "resolution"; guard += 1) state = openResolution(applyResolution(state, choice), made.ctx);
  return { made, state };
}
const xpOf = (layout: DepthsLayout = {}, tweak?: (state: ScenarioState) => ScenarioState): number => resolutionResult(resolved(layout, tweak).state)?.xp ?? 0;
const out = (state: ScenarioState): ScenarioState => ({ ...state, seats: [state.seats[0]!, { ...state.seats[1]!, eliminated: true }] });
const resourcesOn = (code: string, resources: number) => (state: ScenarioState): ScenarioState => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, card.code === code ? { ...card, resources } : card])) });
const face = (code: string, side: "A" | "B") => (state: ScenarioState): ScenarioState => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, card.code === code ? { ...card, face: side } : card])) });

describe("the campaign card's XP list (11194:B:3 to 11194:B:9)", () => {
  it("the baseline gains 1 XP for the one surviving player and nothing else (B:3)", () => {
    expect(xpOf()).toBe(1);
  });

  it("gains 1 XP for each surviving player, and none for a player who is eliminated (B:3)", () => {
    expect(xpOf({ seats: 2, threat: [45, 45] })).toBe(2);
    expect(xpOf({ seats: 2, threat: [45, 50] }, out)).toBe(1);
  });

  it("gains 1 XP if Captain Sahír has 5 or more resources (B:4)", () => {
    expect(xpOf({}, resourcesOn(CODES.sahirAlly, 4))).toBe(1);
    expect(xpOf({}, resourcesOn(CODES.sahirAlly, 5))).toBe(2);
    expect(xpOf({}, resourcesOn(CODES.sahirAlly, 9))).toBe(2);
  });

  it("gains 1 XP if Na'asiyah has 5 or more resources (B:5)", () => {
    expect(xpOf({}, resourcesOn(CODES.naasiyahAlly, 4))).toBe(1);
    expect(xpOf({}, resourcesOn(CODES.naasiyahAlly, 5))).toBe(2);
    expect(xpOf({}, (state) => resourcesOn(CODES.naasiyahAlly, 5)(resourcesOn(CODES.sahirAlly, 5)(state)))).toBe(3);
  });

  it("gains 1 XP if Sea Serpent is in play on its Enraged side, 2 XP instead if it is in the victory display (B:6)", () => {
    expect(xpOf({ staging: [CODES.seaSerpent] })).toBe(1);
    expect(xpOf({ staging: [CODES.seaSerpent] }, face(CODES.seaSerpent, "B"))).toBe(2);
    expect(xpOf({ engaged: [{ code: CODES.seaSerpent, seat: 0 }] }, face(CODES.seaSerpent, "B"))).toBe(2);
    expect(xpOf({ victory: [CODES.seaSerpent] })).toBe(3);
  });

  it("gains 1 XP if each hero has no damage on it (B:7)", () => {
    expect(xpOf({ damage: [] })).toBe(2);
    expect(xpOf({ damage: [["dh2", 1]] })).toBe(1);
    expect(xpOf({ seats: 2, threat: [45, 45], damage: [] })).toBe(3);
    expect(xpOf({ seats: 2, threat: [45, 45], damage: [["dh3", 2]] })).toBe(2);
  });

  it("gains 1 XP if each surviving player's threat is 40 or less, 2 XP instead if it is 30 or less (B:8)", () => {
    expect(xpOf({ threat: [41, 26] })).toBe(1);
    expect(xpOf({ threat: [40, 26] })).toBe(2);
    expect(xpOf({ threat: [31, 26] })).toBe(2);
    expect(xpOf({ threat: [30, 26] })).toBe(3);
    expect(xpOf({ seats: 2, threat: [30, 31] })).toBe(2 + 1);
    expect(xpOf({ seats: 2, threat: [30, 30] })).toBe(2 + 2);
    expect(xpOf({ seats: 2, threat: [30, 50] }, out)).toBe(1 + 2);
  });

  it("gains -1 XP if Ominous Fate is in the victory display, not for more than one copy (B:9)", () => {
    expect(xpOf({ victory: [CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.seaSerpent] })).toBe(2);
  });
});

describe("the card the Resolution lets the players keep (11194:B:1)", () => {
  it("lets the first player add Come Together to the Campaign Pool, or leave it out", () => {
    const made = depthsTable(world, BASE);
    const won: ScenarioState = { ...made.state, window: null, stageCleared: true, resolution: world.definition.resolution };
    const asked = openResolution(won, made.ctx);
    expect(asked.window).toMatchObject({ kind: "resolution", seat: 0 });
    expect(resolutionIntents(asked, made.ctx).map((intent) => (intent.type === "ChooseResolution" ? intent.optionId : "")).sort()).toEqual([CODES.comeTogether, "skip"].sort());
    expect(resolutionResult(resolved({}, undefined, CODES.comeTogether).state)?.earned).toEqual([expect.objectContaining({ code: CODES.comeTogether, to: "pool" })]);
    expect(resolutionResult(resolved().state)?.earned).toEqual([]);
    expect(idOf(made.state, "dh1")).toBeTruthy();
  });
});

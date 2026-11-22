// Rules: dcce.gaining-xp, dcce.hard-expert, dcce.campaign-mode, dcce.island-map, dcce.uncharted, ltp.campaign-pool (data/rules/entries.json). The XP lines of the campaign card's Resolution (11197:B:3 to 11197:B:9), each run on a
// table that makes that line true against a baseline that makes every other line false: one surviving player over the threat limit, no resource on the campaign card, five locations of the map flipped over (one more than earns B:6)
// Temple Guardian not in the victory display, Ominous Fate not in it either (1 XP). And the cards the Resolution earns (11197:B:1): Starla, and each Recurring Nightmare that is no secret, for a
// player the first player chooses.
import { beforeAll, describe, expect, it } from "vitest";

import { applyResolution, openResolution, resolutionIntents, resolutionResult } from "../../../rules/setup/resolution.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { scenarioDefinition } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { CODES, campaign, dealt, idOf, templeTable, loadTempleWorld, type TempleLayout, type TempleWorld } from "../../../../test/scenarios/temple-of-the-deceived/scene.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

// Five locations (indexes 1 to 3, 5 and 6) are flipped over and ten lie Uncharted side up, so the baseline is just past the 4 flipped locations that earn B:6; the Temple column holds Temple Halls twice and The Grotto's Entrance once.
const COVERED = ["?12072", "12073", "12074", "11072", "?12068", "11073", "11074", "?12072", "?12073", "?12069", "?12074", "?11072", "?11073", "?11074", "?12069"] as const;
const BASE: TempleLayout = { map: COVERED, at: 0, threat: [45, 26], campaign: true, phase: "Quest" };

// The log the Resolution writes for the table `layout` describes, won; every choice is answered by `choice` (the first option by default).
function resolved(layout: TempleLayout = {}, tweak: (state: ScenarioState) => ScenarioState = (state) => state, choice?: (state: ScenarioState) => string) {
  const made = templeTable(world, { ...BASE, ...layout });
  // With `without`, the Resolution is the campaign card's records less the ones that name those lines.
  const definition = layout.without ? scenarioDefinition(dealt, campaign, layout.without.reduce(withoutLine, EFFECTS)) : world.definition;
  const won: ScenarioState = tweak({ ...made.state, window: null, stageCleared: true, resolution: definition.resolution });
  let state = openResolution(won, made.ctx);
  for (let guard = 0; guard < 8 && state.window?.kind === "resolution"; guard += 1) {
    const options = resolutionIntents(state, made.ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    state = openResolution(applyResolution(state, choice?.(state) ?? options[0] ?? "skip"), made.ctx);
  }
  return { made, state };
}
const xpOf = (layout: TempleLayout = {}, tweak?: (state: ScenarioState) => ScenarioState): number => resolutionResult(resolved(layout, tweak).state)?.xp ?? 0;
const out = (state: ScenarioState): ScenarioState => ({ ...state, seats: [state.seats[0]!, { ...state.seats[1]!, eliminated: true }] });
const resourcesOn = (code: string, resources: number) => (state: ScenarioState): ScenarioState => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, card.code === code ? { ...card, resources } : card])) });
// Turns the cells at these indexes to the real location they are.
const flipped = (...indexes: number[]) => (made: { cells: readonly string[] }) => (state: ScenarioState): ScenarioState => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, indexes.some((at) => made.cells[at] === id) ? { ...card, face: "A" as const } : card])) });

describe("the campaign card's XP list (11197:B:2 to 11197:B:9)", () => {
  it("the baseline gains 1 XP for the one surviving player and nothing else (B:3)", () => {
    expect(xpOf()).toBe(1);
  });

  it("gains 1 XP for each surviving player, and none for a player who is eliminated (B:3)", () => {
    expect(xpOf({ seats: 2, threat: [45, 45] })).toBe(2);
    expect(xpOf({ seats: 2, threat: [45, 50] }, out)).toBe(1);
  });

  it("gains 1 XP for each resource on the campaign card, at most 3 XP (B:4)", () => {
    expect(xpOf({}, resourcesOn(CODES.campaignCard, 1))).toBe(2);
    expect(xpOf({}, resourcesOn(CODES.campaignCard, 3))).toBe(4);
    expect(xpOf({}, resourcesOn(CODES.campaignCard, 7))).toBe(4);
  });

  it("gains 1 XP for each faceup Temple Halls, a Temple Halls whose location side is up (B:5)", () => {
    const made = templeTable(world, { ...BASE });
    const turn = flipped(9, 14)(made);
    expect(xpOf({}, turn)).toBe(1 + 2);
    expect(xpOf({}, flipped(9)(made))).toBe(1 + 1);
    // The Grotto's Entrance (index 4) is no Temple Halls.
    expect(xpOf({}, flipped(4)(made))).toBe(1);
    // A Temple Halls still lying Temple of the Deceived side up counts for nothing.
    expect(xpOf({})).toBe(1);
  });

  it("gains 1 XP if 4 or fewer of the double-sided locations are flipped over, a short route (B:6; user decision, 2026-11-01)", () => {
    const made = templeTable(world, { ...BASE });
    // The baseline flips 5 locations; the Temple Halls among them are no part of it (index 9 and 14 stay covered).
    const unflip = (...indexes: number[]) => (state: ScenarioState): ScenarioState => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, indexes.some((at) => made.cells[at] === id) ? { ...card, face: "B" as const } : card])) });
    expect(xpOf({})).toBe(1);
    expect(xpOf({}, unflip(1))).toBe(2);
    expect(xpOf({}, unflip(1, 2, 3, 5, 6))).toBe(2);
    // A sixth flipped location still earns nothing.
    expect(xpOf({}, flipped(7)(made))).toBe(1);
  });

  it("gains 1 XP if Temple Guardian is in the victory display, the reprint or the original (B:7)", () => {
    expect(xpOf({ victory: [CODES.guardian] })).toBe(2);
    expect(xpOf({ victory: [CODES.guardianOriginal] })).toBe(2);
    expect(xpOf({ victory: [CODES.guardian, CODES.guardianOriginal] })).toBe(2);
  });

  it("gains 1 XP if each surviving player's threat is 40 or less (B:8)", () => {
    expect(xpOf({ threat: [41, 26] })).toBe(1);
    expect(xpOf({ threat: [40, 26] })).toBe(2);
    expect(xpOf({ seats: 2, threat: [30, 41] })).toBe(2);
    expect(xpOf({ seats: 2, threat: [30, 40] })).toBe(2 + 1);
    expect(xpOf({ seats: 2, threat: [30, 50] }, out)).toBe(1 + 1);
  });

  it("gains -1 XP if Ominous Fate is in the victory display, not for more than one copy (B:9)", () => {
    expect(xpOf({ victory: [CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.ominousFate] })).toBe(0);
    expect(xpOf({ victory: [CODES.ominousFate, CODES.guardian] })).toBe(1);
  });
});

describe("the cards the Resolution earns (11197:B:1)", () => {
  it("adds Starla to the Campaign Pool if she is under a player's control, and not if she is not", () => {
    const earned = (layout: TempleLayout) => resolutionResult(resolved(layout).state)?.earned.map((item) => item.code) ?? [];
    expect(earned({ play: [CODES.starla] })).toEqual([CODES.starla]);
    expect(earned({})).toEqual([]);
    // Starla still facedown as a secret is no one's.
    expect(earned({ secrets: ["", CODES.starla, ""] })).toEqual([]);
  });

  it("adds each Recurring Nightmare that is not a secret to the pool for a player the first player chooses, shuffled into their deck after the starting hand", () => {
    const earned = (layout: TempleLayout, choice?: (state: ScenarioState) => string) => resolutionResult(resolved(layout, undefined, choice).state)?.earned ?? [];
    // Both are secrets: nothing is earned and no one is asked.
    expect(earned({ secrets: [CODES.nightmare, CODES.nightmare, ""] })).toEqual([]);
    // One was flipped: engaged with a player; the other is a secret.
    const one = earned({ engaged: [{ code: CODES.nightmare, seat: 0 }], secrets: ["", CODES.nightmare, ""] });
    expect(one).toEqual([expect.objectContaining({ code: CODES.nightmare, to: "pool", seat: 0, hero: null, afterHand: true, copy: 0 })]);
    // Both were flipped: two entries for the two players the first player chooses; the chosen hero names the player.
    const two = earned({ seats: 2, threat: [45, 45], engaged: [{ code: CODES.nightmare, seat: 0 }, { code: CODES.nightmare, seat: 1 }] }, (state) => {
      const options = resolutionIntents(state, templeTable(world, { ...BASE, seats: 2 }).ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
      return options.at(-1) ?? "skip";
    });
    expect(two.map((item) => [item.code, item.seat, item.copy])).toEqual([[CODES.nightmare, 1, 0], [CODES.nightmare, 1, 1]]);
  });

  it("offers one option for each player, named by a hero they control", () => {
    const made = templeTable(world, { ...BASE, seats: 2, threat: [45, 45], engaged: [{ code: CODES.nightmare, seat: 0 }] });
    const won: ScenarioState = { ...made.state, window: null, stageCleared: true, resolution: world.definition.resolution };
    const asked = openResolution(won, made.ctx);
    expect(asked.window).toMatchObject({ kind: "resolution", seat: 0 });
    const options = resolutionIntents(asked, made.ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    expect(options).toEqual([`${CODES.nightmare}>${made.hero}`, `${CODES.nightmare}>${made.seat1Hero}`]);
    expect(idOf(made.state, CODES.nightmare)).toBeTruthy();
  });
});

// Each XP line on the table that makes it true, and again with its record left out: the XP must fall.
describe("the campaign card's XP lines, with and without their records (11197:B:4 to 11197:B:8)", () => {
  const both = (line: string, layout: TempleLayout, tweak?: (state: ScenarioState) => ScenarioState) => [xpOf(layout, tweak), xpOf({ ...layout, without: [line] }, tweak)];

  it("11197:B:4 gains 1 XP for each resource on this card, at most 3", () => {
    expect(both("11197:B:4", {}, resourcesOn(CODES.campaignCard, 2))).toEqual([1 + 2, 1]);
    expect(both("11197:B:4", {}, resourcesOn(CODES.campaignCard, 5))).toEqual([1 + 3, 1]);
  });

  it("11197:B:5 gains 1 XP for each faceup Temple Halls", () => {
    const made = templeTable(world, { ...BASE });
    expect(both("11197:B:5", {}, flipped(9, 14)(made))).toEqual([1 + 2, 1]);
  });

  it("11197:B:6 gains 1 XP if 4 or fewer Uncharted locations are faceup", () => {
    // Index 1 back to its Lost Island side leaves 4 flipped.
    const made = templeTable(world, { ...BASE });
    const four = (state: ScenarioState): ScenarioState => ({ ...state, cards: { ...state.cards, [made.cells[1]!]: { ...state.cards[made.cells[1]!]!, face: "B" } } });
    expect(both("11197:B:6", {}, four)).toEqual([1 + 1, 1]);
    expect(both("11197:B:6", {})).toEqual([1, 1]);
  });

  it("11197:B:7 gains 1 XP if Temple Guardian is in the victory display", () => {
    expect(both("11197:B:7", { victory: [CODES.guardian] })).toEqual([1 + 1, 1]);
    expect(both("11197:B:7", { victory: [CODES.guardianOriginal] })).toEqual([1 + 1, 1]);
    // In play, it earns nothing.
    expect(xpOf({ staging: [CODES.guardian] })).toBe(1);
  });

  it("11197:B:8 gains 1 XP if each surviving player's threat is 40 or less", () => {
    expect(both("11197:B:8", { threat: [40, 26] })).toEqual([1 + 1, 1]);
    expect(both("11197:B:8", { seats: 2, threat: [30, 40] })).toEqual([2 + 1, 2]);
    // One surviving player at 41: none.
    expect(xpOf({ seats: 2, threat: [30, 41] })).toBe(2);
  });
});

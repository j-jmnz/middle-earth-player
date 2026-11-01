// Rules: dcce.gaining-xp, dcce.hard-expert, dcce.campaign-mode, dcce.island-map, dcce.uncharted, ltp.campaign-pool (data/rules/entries.json). The XP lines of the campaign card's Resolution (11197:B:3 to 11197:B:9), each run on a
// table that makes that line true against a baseline that makes every other line false: one surviving player over the threat limit, no resource on the campaign card, every location of the map lying Uncharted side up
// (so none is flipped), Temple Guardian not in the victory display, Ominous Fate not in it either (1 XP). And the cards the Resolution earns (11197:B:1): Starla, and each Recurring Nightmare that is no secret, for a
// player the first player chooses.
import { beforeAll, describe, expect, it } from "vitest";

import { applyResolution, openResolution, resolutionIntents, resolutionResult } from "../rules/resolution.ts";
import type { ScenarioState } from "../rules/state.ts";
import { CODES, idOf, templeTable, loadTempleWorld, type TempleLayout, type TempleWorld } from "../../scripts/temple-scene.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

// Every location lies Uncharted side up; the Temple column holds Temple Halls twice and The Grotto's Entrance once.
const COVERED = ["?12072", "?12073", "?12074", "?11072", "?12068", "?11073", "?11074", "?12072", "?12073", "?12069", "?12074", "?11072", "?11073", "?11074", "?12069"] as const;
const BASE: TempleLayout = { map: COVERED, at: 0, threat: [45, 26], campaign: true, phase: "Quest" };

// The log the Resolution writes for the table `layout` describes, won; every choice is answered by `choice` (the first option by default).
function resolved(layout: TempleLayout = {}, tweak: (state: ScenarioState) => ScenarioState = (state) => state, choice?: (state: ScenarioState) => string) {
  const made = templeTable(world, { ...BASE, ...layout });
  const won: ScenarioState = tweak({ ...made.state, window: null, stageCleared: true, resolution: world.definition.resolution });
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

  it("gains 1 XP if 4 or fewer Uncharted locations are faceup, lying Lost Island or Temple of the Deceived side up (B:6)", () => {
    const made = templeTable(world, { ...BASE });
    const cover = (count: number) => flipped(...Array.from({ length: 15 - count }, (_, at) => at))(made);
    // 5 left covered: no XP; 4 left covered: 1 XP (and the flipped Temple Halls among them gain theirs).
    const only = (count: number) => (state: ScenarioState): ScenarioState => {
      const tweaked = cover(count)(state);
      return { ...tweaked, cards: Object.fromEntries(Object.entries(tweaked.cards).map(([id, card]) => [id, card.code === "12069" && card.face === "A" ? { ...card, code: "11072" } : card])) };
    };
    expect(xpOf({}, only(5))).toBe(1);
    expect(xpOf({}, only(4))).toBe(2);
    expect(xpOf({}, only(0))).toBe(2);
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

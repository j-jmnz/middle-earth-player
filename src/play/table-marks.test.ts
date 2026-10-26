// Rules: rr.engagement-check, rr.optional-engagement, rr.delayed-effects, rr.lasting-effects, rr.winning-the-game,
// rr.step-2-2, rr.resource-match, rr.unique-cards (data/rules/entries.json). What the table marks on its cards and says
// on a tap: which staging enemies engage at the threat, an effect still to come, how a stage without quest points is
// won, and why a hand card does not glow.
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../rules/reduce.ts";
import { updateCard, withThreat, type ScenarioState } from "../rules/state.ts";
import { buildTable, FRODO, idsOf, RIDER, SAM, sceneCards } from "../../scripts/test-scene.ts";

import { delayedLines, slotNumbers } from "./card-effects.ts";
import { enemiesToFace, threatRows, threatVerdict } from "./foresight.ts";
import { ledgerLine } from "./ledger.ts";
import { questObjective } from "./objective.ts";
import type { SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";
import { whyNotPlayable } from "./why.ts";

const names: SheetNames = { card: (id) => id, line: () => null };
let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

describe("engagement marks", () => {
  it("marks an enemy in staging that engages at the threat, and one that stays", () => {
    const table = buildTable(base, { staging: [RIDER, "f0"] });
    const rider = idsOf(table, RIDER);
    // The Black Rider's engagement cost is 35; the stand-in enemy's is 50.
    expect(slotNumbers(withThreat(table.state, 0, 34), table.ctx, rider, 0).engagement).toEqual({ cost: 35, engages: false });
    expect(slotNumbers(withThreat(table.state, 0, 35), table.ctx, rider, 0).engagement).toEqual({ cost: 35, engages: true });
    expect(slotNumbers(table.state, table.ctx, idsOf(table, FRODO), 0).engagement).toBeNull();
    expect(threatRows(withThreat(table.state, 0, 40), table.ctx).map((row) => [row.cost, row.engagesSeat])).toEqual([
      [35, 0],
      [50, null],
    ]);
  });

  it("follows the engine's checks: an enemy that cannot be engaged stays, and one enemy engages one seat (rr.engagement-check)", () => {
    const table = buildTable(base, { staging: [RIDER] });
    const rider = idsOf(table, RIDER);
    // "Enemies cannot be engaged" (Midgewater, 141048:A:1), as the flag its record sets.
    const barred: ScenarioState = { ...withThreat(table.state, 0, 40), modifiers: [{ instanceId: rider, sourceId: rider, stat: "cannotBeEngaged", amount: 1, until: "endOfRound" }] };
    expect(slotNumbers(barred, table.ctx, rider, 0).engagement).toEqual({ cost: 35, engages: false });
    const [row] = threatRows(barred, table.ctx);
    expect(row && threatVerdict(row, 0)).toEqual({ word: "Cannot be engaged", engages: false });
    expect(enemiesToFace(barred, table.ctx, 0)).toEqual([]);
    // Two seats at threat 40: the first player's check engages the Black Rider, so the second seat does not face it.
    const two = buildTable(base, { seats: 2, heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 1 }], ring: "none", staging: [RIDER] });
    const both = withThreat(withThreat(two.state, 0, 40), 1, 40);
    const first = both.firstPlayer;
    const other = first === 0 ? 1 : 0;
    expect(enemiesToFace(both, two.ctx, first)).toEqual([idsOf(two, RIDER)]);
    expect(enemiesToFace(both, two.ctx, other)).toEqual([]);
    const [shared] = threatRows(both, two.ctx);
    expect(shared && threatVerdict(shared, other)).toEqual({ word: `Engages Player ${first + 1}`, engages: false });
  });

  it("the optional engagement says the threat and which enemies the checks engage anyway", () => {
    const table = buildTable(base, { start: "encounter", staging: [RIDER, "f0"] });
    const state = withThreat(table.state, 0, 40);
    const sheet = sheetFor(state, table.ctx, legalIntents(state, table.ctx), names);
    expect(sheet?.kind === "pick" ? sheet.note : "").toBe(`You may engage one enemy in staging. Your threat is 40. The checks engage ${idsOf(table, RIDER)} (35) anyway. ${idsOf(table, "f0")} (50) stays in staging.`);
  });
});

describe("effects that come later, and effects that end", () => {
  it("names a delayed effect on the card it will act on", () => {
    const table = buildTable(base, { allies: [{ code: "ally", seat: 0 }] });
    const ally = idsOf(table, "ally");
    const state = { ...table.state, delayed: [{ id: "d0:1", until: "endOfPhase" as const, sourceId: idsOf(table, SAM), seat: 0, phase: "Combat", instructions: [{ verb: "ReturnToHand" as const }], uncancelable: null, subjectId: ally }] };
    expect(delayedLines(state, ally, (id) => (id === idsOf(table, SAM) ? "Sneak Attack" : id))).toEqual(["At the end of this phase: returns to its owner's hand (Sneak Attack)"]);
    expect(slotNumbers(state, table.ctx, ally, 0).delayed).toBe(true);
  });

  it("marks a number changed only until the end of the round as lasting", () => {
    const table = buildTable(base, {});
    const sam = idsOf(table, SAM);
    const state = { ...table.state, modifiers: [...table.state.modifiers, { instanceId: sam, sourceId: sam, stat: "attack" as const, amount: 1, until: "endOfRound" as const }] };
    expect(slotNumbers(state, table.ctx, sam, 0).effects.stats).toEqual([expect.objectContaining({ stat: "attack", delta: 1, lasting: true })]);
  });
});

describe("the quest objective", () => {
  it("reads the printed line that wins a stage with no quest points", () => {
    const ferry = buildTable(base, { stage: "141024", staging: ["141035"] });
    expect(questObjective(ferry.state, ferry.ctx, ledgerLine)).toBe("After Bucklebury Ferry leaves play as an explored location, the players win the game.");
    const first = buildTable(base, { stage: "141022" });
    expect(questObjective(first.state, first.ctx, ledgerLine)).toBeNull();
  });
});

describe("why a hand card does not glow", () => {
  it("says the sphere rule, the cost against the pools, and the planning rule", () => {
    // The stand-in ally costs 1 Leadership; Frodo alone (Fellowship) cannot pay for it.
    const frodo = buildTable(base, { start: "planning", heroes: [{ code: FRODO, seat: 0 }], hand: [{ code: "ally", seat: 0 }] });
    expect(whyNotPlayable(frodo.state, frodo.ctx, idsOf(frodo, "ally"), (id) => id)).toBe("No Leadership hero is in play to pay for it.");
    const paid = buildTable(base, { start: "planning", heroes: [{ code: "pal", seat: 0 }], hand: [{ code: "ally", seat: 0 }], ring: "none" });
    expect(whyNotPlayable(paid.state, paid.ctx, idsOf(paid, "ally"), (id) => id)).toBe("It costs 1. Your Leadership heroes have 0 resources.");
    const funded = updateCard(paid.state, idsOf(paid, "pal"), { resources: 1 });
    expect(whyNotPlayable(funded, paid.ctx, idsOf(paid, "ally"), (id) => id)).toBeNull();
    const quest = buildTable(base, { start: "quest", heroes: [{ code: "pal", seat: 0 }], hand: [{ code: "ally", seat: 0 }], ring: "none" });
    expect(whyNotPlayable(quest.state, quest.ctx, idsOf(quest, "ally"), (id) => id)).toBe("Allies are played in the planning phase.");
  });
});

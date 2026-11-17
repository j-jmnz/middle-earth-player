import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { cardMap, expectOk, fixtureDefinition, hero } from "../../core/test-fixture.ts";
import { placeDamage } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { reduce } from "../../engine/reduce.ts";
import { blankScenario, updateCard, type ScenarioState } from "../../core/state.ts";
import { ruleCause } from "../../core/cause.ts";
import { spawn } from "../../core/zones.ts";
import { markEnemyDamage } from "./patrol.ts";

// Rules: rr.cancel, rr.damage (data/rules/entries.json); ledger line 03014:A:1. "Before Patrol Leader is dealt damage, discard the top card of the encounter deck. If the discarded card is an enemy, cancel that damage."
// An enemy whose own Forced effect hears `damageDealt` (markEnemyDamage) is offered the damage before it is destroyed; its records discard the top card and cancel the damage when that card is an enemy.

const lead = hero("lead", "leadership", 9, 2);
const leader = definePrinted({ code: "leader", name: "Leader", type: "enemy", attack: 3, defense: 1, health: 4, engagementCost: 30, threat: 2 });
const plain = definePrinted({ code: "plain", name: "Plain", type: "enemy", attack: 3, defense: 1, health: 4, engagementCost: 30, threat: 2 });
const foe = definePrinted({ code: "foe", name: "Foe", type: "enemy", attack: 3, defense: 1, health: 4, engagementCost: 30, threat: 2 });
const trap = definePrinted({ code: "trap", name: "Trap", type: "treachery" });
const cards = cardMap([lead, leader, plain, foe, trap]);

// 03014:forced:1 as the records write it.
const FORCED: Effect = {
  id: "leader:forced:1",
  cardCode: "leader",
  lines: ["leader:A:1"],
  timing: "forced",
  trigger: "damageDealt",
  subject: "self",
  instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "CancelDamage", all: true, when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" } } }],
};

function scene(deck: readonly string[], code = "leader") {
  let state = blankScenario({ seatCount: 1, seed: 3, definition: fixtureDefinition(["stage"]) });
  const placed = spawn(state, code, { zone: "engaged", seat: 0 });
  state = spawn(placed.state, "lead", { zone: "heroes", seat: 0 }).state;
  for (const top of deck) state = spawn(state, top, { zone: "encounterDeck" }).state;
  state = { ...state, phase: "Combat", mode: "planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
  const ctx = { effects: [FORCED], cards };
  return { state: markEnemyDamage(state, ctx), id: placed.id, ctx };
}

function hit(state: ScenarioState, id: string, amount: number, ctx: ReturnType<typeof scene>["ctx"]): ScenarioState {
  const damaged = placeDamage({ ...state, holdLethal: true }, id, amount, ctx.cards, [], "framework", ruleCause("rr.damage"));
  return expectOk(reduce(damaged, { type: "Pass" }, ctx)).state;
}

describe("03014:A:1 damage dealt to an enemy that answers it", () => {
  it("is read from the records: only an enemy that hears damageDealt on itself is marked", () => {
    const { state } = scene([]);
    expect(state.enemyDamageHeard).toEqual(["leader"]);
    expect(scene([], "plain").state.enemyDamageHeard).toBeUndefined();
  });

  it("is canceled when the discarded top card is an enemy, and the card is in the discard pile (rr.cancel)", () => {
    const { state, id, ctx } = scene(["foe", "trap"]);
    const after = hit(state, id, 3, ctx);
    expect(after.cards[id]?.damage).toBe(0);
    expect(after.encounterDiscard.map((card) => after.cards[card]?.code)).toEqual(["foe"]);
  });

  it("keeps the damage when the discarded card is not an enemy", () => {
    const { state, id, ctx } = scene(["trap", "foe"]);
    const after = hit(state, id, 3, ctx);
    expect(after.cards[id]?.damage).toBe(3);
    expect(after.encounterDiscard.map((card) => after.cards[card]?.code)).toEqual(["trap"]);
  });

  it("is answered before the damage destroys it: an enemy discarded cancels lethal damage", () => {
    const { state, id, ctx } = scene(["foe"]);
    const after = hit(state, id, 4, ctx);
    expect(after.cards[id]?.zone).toBe("engaged");
    expect(after.cards[id]?.damage).toBe(0);
  });

  it("is destroyed by lethal damage when the discarded card is not an enemy", () => {
    const { state, id, ctx } = scene(["trap"]);
    const after = hit(state, id, 4, ctx);
    expect(after.cards[id]?.zone).toBe("encounterDiscard");
  });

  it("discards nothing and cancels nothing from an empty deck (rr.running-out-of-cards)", () => {
    const { state, id, ctx } = scene([]);
    const after = hit(state, id, 2, ctx);
    expect(after.cards[id]?.damage).toBe(2);
    expect(after.encounterDiscard).toEqual([]);
  });

  it("an enemy with no such line takes damage as before and hears nothing", () => {
    const { state, id, ctx } = scene(["foe"], "plain");
    const after = hit(updateCard(state, id, {}), id, 3, ctx);
    expect(after.cards[id]?.damage).toBe(3);
    expect(after.encounterDeck).toHaveLength(1);
  });
});

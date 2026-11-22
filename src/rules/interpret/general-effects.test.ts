import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";

import { resolveAmount } from "./amounts.ts";
import { holds } from "./conditions.ts";
import { syncConstants } from "./constants.ts";
import { cardMap, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { modifiedStat, placeDamage } from "../core/keywords.ts";
import { definePrinted } from "../core/printed.ts";
import { legalIntents, legalTargets, reduce } from "../engine/reduce.ts";
import { blankScenario, updateCard, withThreat, type ScenarioState } from "../core/state.ts";
import { ruleCause } from "../core/cause.ts";
import { spawn } from "../core/zones.ts";

// Rules: rr.response, rr.cancel, rr.constant-ability, rr.modifiers, rr.limits (data/rules/entries.json).
// The general effect vocabulary the player pool's records use (docs/agents/effect-authoring.md): filters and read amounts,
// subjects on triggers, the damage window, host-less constants, play rules, cost lists and flags.

const lead = hero("lead", "leadership", 9, 2);
const silvan = definePrinted({ code: "silvan", name: "Silvan Ally", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Silvan"] });
const elf = definePrinted({ code: "elf", name: "Elf Lord", type: "ally", sphere: "leadership", cost: 0, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Silvan"] });
const orc = definePrinted({ code: "orc", name: "Orc", type: "enemy", attack: 3, defense: 1, health: 4, engagementCost: 30, threat: 2, traits: ["Orc"] });
const ward = definePrinted({ code: "ward", name: "Ward", type: "event", sphere: "leadership", cost: 0 });

function table(extra: readonly Effect[], cards = cardMap([lead, silvan, elf, orc, ward])) {
  let state = blankScenario({ seatCount: 1, seed: 3, definition: fixtureDefinition(["stage"]) });
  const leader = spawn(state, "lead", { zone: "heroes", seat: 0 });
  state = updateCard(leader.state, leader.id, { resources: 5 });
  state = { ...state, phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
  return { state, heroId: leader.id, ctx: { effects: extra, cards } };
}

function add(state: ScenarioState, code: string, zone: "hand" | "play" | "heroes" | "discard" | "engaged" | "staging") {
  return zone === "staging" ? spawn(state, code, { zone }) : spawn(state, code, { zone, seat: 0 });
}

describe("filters and read amounts", () => {
  it("count matching cards for an amount and a condition, from the actor's side", () => {
    const { state, ctx } = table([]);
    let next = add(state, "orc", "engaged").state;
    next = add(next, "orc", "staging").state;
    next = add(next, "silvan", "play").state;
    expect(resolveAmount(next, { count: { type: "enemy", control: "any", engaged: "you" } }, { actor: 0, sourceId: null }, ctx)).toBe(1);
    expect(resolveAmount(next, { count: { type: "enemy", control: "any", staging: true } }, { actor: 0, sourceId: null }, ctx)).toBe(2);
    expect(resolveAmount(next, { count: { type: "character", control: "you", trait: "Silvan" }, times: 2, plus: 1 }, { actor: 0, sourceId: null }, ctx)).toBe(3);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(next, { kind: "count", pick: { type: "character", control: "you", trait: "Silvan" }, min: 1 }, scope, ctx)).toBe(true);
    expect(holds(next, { kind: "allMatch", of: { type: "character", control: "you" }, match: { type: "character", control: "you", trait: "Silvan" } }, scope, ctx)).toBe(false);
    expect(holds(withThreat(next, 0, 40), { kind: "threat", min: 40, valour: true }, scope, ctx)).toBe(true);
    expect(holds(next, { kind: "not", condition: { kind: "threat", min: 40, valour: true } }, scope, ctx)).toBe(true);
  });

  it("give a constant to every card a filter names, with an amount read each time the records are rebuilt", () => {
    const banner: Effect = {
      id: "banner:constant:1",
      cardCode: "elf",
      lines: ["elf:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: { type: "enemy", control: "any", engaged: "you" } }, until: "whileSourceInPlay", holders: { type: "character", control: "you", trait: "Silvan" } }],
    };
    const { state, ctx } = table([banner]);
    const lord = add(state, "elf", "play");
    const helper = add(lord.state, "silvan", "play");
    const synced = syncConstants(add(helper.state, "orc", "engaged").state, ctx);
    expect(modifiedStat(synced, synced.cards[helper.id]!, "attack", ctx.cards)).toBe(2);
    expect(modifiedStat(synced, synced.cards[lord.id]!, "attack", ctx.cards)).toBe(2);
  });
});

describe("triggers with a subject", () => {
  it("hear another card's event: After a Silvan ally enters play, that ally gets +1 Attack until the end of the round", () => {
    const greeting: Effect = {
      id: "elf:response:1",
      cardCode: "elf",
      lines: ["elf:A:1"],
      timing: "response",
      trigger: "enteredPlay",
      subject: { type: "ally", control: "you", trait: "Silvan", other: true },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "subject" }],
    };
    const { state, heroId, ctx } = table([greeting]);
    const lord = add(state, "elf", "play");
    const newcomer = add(lord.state, "silvan", "hand");
    const played = expectOk(reduce(newcomer.state, { type: "PlayCard", cardId: newcomer.id, payments: [{ heroId, amount: 1 }] }, ctx)).state;
    expect(legalIntents(played, ctx)).toContainEqual({ type: "Trigger", cardId: lord.id, effectId: "elf:response:1" });
    const used = expectOk(reduce(played, { type: "Trigger", cardId: lord.id, effectId: "elf:response:1" }, ctx)).state;
    expect(modifiedStat(used, used.cards[newcomer.id]!, "attack", ctx.cards)).toBe(2);
    expect(modifiedStat(used, used.cards[lord.id]!, "attack", ctx.cards)).toBe(1);
  });
});

describe("damage just dealt", () => {
  it("can be canceled before it destroys the character (rr.cancel)", () => {
    const shield: Effect = {
      id: "ward:response:1",
      cardCode: "ward",
      lines: ["ward:A:1"],
      timing: "response",
      trigger: "damageDealt",
      subject: { type: "character", control: "you" },
      cost: { kind: "playEvent" },
      instructions: [{ verb: "CancelDamage", amount: 2 }],
    };
    const { state, ctx } = table([shield]);
    const helper = add(state, "silvan", "play");
    const card = add(helper.state, "ward", "hand");
    const hit = placeDamage({ ...card.state, holdLethal: true }, helper.id, 2, ctx.cards, [], "framework", ruleCause("rr.damage"));
    expect(hit.cards[helper.id]?.zone).toBe("play");
    // Settle offers the Response before the sweep; using it leaves the ally standing.
    const offered = expectOk(reduce(hit, { type: "Pass" }, ctx)).state;
    expect(legalIntents(offered, ctx)).toContainEqual({ type: "Trigger", cardId: card.id, effectId: "ward:response:1" });
    const saved = expectOk(reduce(offered, { type: "Trigger", cardId: card.id, effectId: "ward:response:1", payments: [] }, ctx)).state;
    expect(saved.cards[helper.id]?.zone).toBe("play");
    expect(saved.cards[helper.id]?.damage).toBe(0);
  });

  it("destroys at once when no card could cancel it", () => {
    const { state, ctx } = table([]);
    const helper = add(state, "silvan", "play");
    const hit = placeDamage(helper.state, helper.id, 2, ctx.cards, [], "framework", ruleCause("rr.damage"));
    expect(hit.cards[helper.id]?.zone).toBe("discard");
  });
});

describe("play rules and costs", () => {
  it("refuse a play whose restriction fails, and offer a card its text lets you play from the discard pile", () => {
    const rules: Effect[] = [
      { id: "silvan:constant:1", cardCode: "silvan", lines: ["silvan:A:1"], timing: "constant", instructions: [{ verb: "PlayOnlyIf", condition: { kind: "count", pick: { type: "enemy", control: "any", engaged: "you" }, min: 1 } }] },
      { id: "elf:constant:1", cardCode: "elf", lines: ["elf:A:1"], timing: "constant", instructions: [{ verb: "PlayFromDiscard" }, { verb: "EntersPlayExhausted" }] },
    ];
    const { state, heroId, ctx } = table(rules);
    const blocked = add(state, "silvan", "hand");
    expect(legalIntents(blocked.state, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === blocked.id)).toBe(false);
    const engaged = add(blocked.state, "orc", "engaged").state;
    expect(legalIntents(engaged, ctx)).toContainEqual({ type: "PlayCard", cardId: blocked.id });
    const buried = add(state, "elf", "discard");
    expect(legalIntents(buried.state, ctx)).toContainEqual({ type: "PlayCard", cardId: buried.id });
    const raised = expectOk(reduce(buried.state, { type: "PlayCard", cardId: buried.id, payments: [] }, ctx)).state;
    expect(raised.cards[buried.id]?.zone).toBe("play");
    expect(raised.cards[buried.id]?.exhausted).toBe(true);
    void heroId;
  });

  it("pay a list of costs together and count a limit of three a phase", () => {
    const rally: Effect = {
      id: "lead:action:1",
      cardCode: "lead",
      lines: ["lead:A:1"],
      timing: "action",
      cost: [{ kind: "raiseThreat", amount: 1 }, { kind: "resources", amount: 1, from: "self" }],
      limit: "thricePerPhase",
      instructions: [{ verb: "Draw", amount: 1 }],
    };
    const { state: bare, heroId, ctx } = table([rally]);
    // Three cards in the deck: each use draws one, and a draw from an empty deck changes nothing (rr.running-out-of-cards).
    let next = bare;
    for (let card = 0; card < 3; card += 1) next = spawn(next, "elf", { zone: "deck", seat: 0 }).state;
    for (let use = 0; use < 3; use += 1) {
      expect(legalIntents(next, ctx)).toContainEqual({ type: "Trigger", cardId: heroId, effectId: "lead:action:1" });
      next = expectOk(reduce(next, { type: "Trigger", cardId: heroId, effectId: "lead:action:1", payments: [{ heroId, amount: 1 }] }, ctx)).state;
    }
    expect(next.seats[0].threat).toBe(3);
    expect(next.cards[heroId]?.resources).toBe(2);
    expect(legalIntents(next, ctx).some((intent) => intent.type === "Trigger")).toBe(false);
  });
});

describe("flags", () => {
  it("let an ally with takesUndefendedDamage take an undefended attack, and a cannotDefend character not defend", () => {
    const rules: Effect[] = [
      { id: "silvan:constant:1", cardCode: "silvan", lines: ["silvan:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "takesUndefendedDamage", amount: 1, until: "whileSourceInPlay" }] },
      { id: "elf:constant:1", cardCode: "elf", lines: ["elf:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotDefend", amount: 1, until: "whileSourceInPlay" }] },
    ];
    const { state, heroId, ctx } = table(rules);
    const helper = add(state, "silvan", "play");
    const lord = add(helper.state, "elf", "play");
    const enemy = add(lord.state, "orc", "engaged");
    const attacked = syncConstants({ ...enemy.state, phase: "Combat", mode: "enemyAttacks", window: { kind: "defense", enemyId: enemy.id, seat: 0 }, pendingAttack: { enemyId: enemy.id, seat: 0 } }, ctx);
    expect(legalTargets(attacked, { type: "Undefended" }, ctx)).toEqual([heroId, helper.id]);
    expect(legalTargets(attacked, { type: "DeclareDefender" }, ctx)).not.toContain(lord.id);
  });
});

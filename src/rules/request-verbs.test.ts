// Rules: rr.limits, rr.cost, rr.damage, rr.staging-area, rr.player-elimination (data/rules/entries.json).
// Engine pieces added for the core-set Learn to Play decks (user request, 2026-10-26), on fixture cards: "Limit X times per
// phase", a cost paid from the source hero's own pool, healing, a card that contributes no threat, and the hero-left-play event.
import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";

import { cardMap, expectOk, hero, idleScenario } from "./fixture.ts";
import type { EngineStep } from "./intents.ts";
import { destroyCard } from "./keywords.ts";
import { definePrinted } from "./printed.ts";
import { stagingThreat } from "./quest.ts";
import { reduce, type ReduceContext } from "./reduce.ts";
import { updateCard } from "./state.ts";
import { spawn } from "./zones.ts";

const foe = definePrinted({ code: "foe", name: "Foe", type: "enemy", threat: 3, engagementCost: 40, attack: 1, defense: 1, health: 3 });
const cards = cardMap([hero("healer", "lore"), hero("other", "lore"), foe]);

function action(extra: Partial<Effect>): Effect {
  return { id: "healer:action:1", cardCode: "healer", lines: ["fixture:A:1"], timing: "action", instructions: [], ...extra };
}

function table(effects: readonly Effect[]) {
  const start = idleScenario(1, "Planning");
  const healer = spawn(start, "healer", { zone: "heroes", seat: 0 });
  const other = spawn(healer.state, "other", { zone: "heroes", seat: 0 });
  const enemy = spawn(other.state, "foe", { zone: "staging" });
  const state = { ...updateCard(updateCard(enemy.state, healer.id, { resources: 2 }), other.id, { resources: 3, damage: 3 }), mode: "planning" as const, window: { kind: "pass" as const }, activeSeat: 0 };
  const ctx: ReduceContext = { effects, cards };
  return { state, ctx, ids: { healer: healer.id, other: other.id, foe: enemy.id } };
}

describe("engine verbs for the core Learn to Play decks", () => {
  it("a limit of X times per phase allows X uses (rr.limits)", () => {
    const { state, ctx, ids } = table([action({ limit: "oncePerPhase", limitTimes: 2, instructions: [{ verb: "Heal", amount: 1, target: "host" }] })]);
    const use = { type: "Trigger" as const, cardId: ids.healer, effectId: "healer:action:1" };
    const twice = expectOk(reduce(expectOk(reduce(state, use, ctx)).state, use, ctx)).state;
    expect(twice.uses).toHaveLength(2);
    const third = reduce(twice, use, ctx);
    expect(third.ok ? null : third.reason).toBe("That effect has already been used");
  });

  it("a cost from the source's own pool is taken from that hero only, and needs it to hold enough (rr.cost)", () => {
    const pick = { verb: "Pick" as const, pick: { type: "character" as const, control: "any" as const, damaged: true } };
    const { state, ctx, ids } = table([action({ cost: { kind: "selfResources", amount: 2 }, instructions: [pick, { verb: "Heal", amount: 2, target: "picked" }] })]);
    const used = expectOk(reduce(state, { type: "Trigger", cardId: ids.healer, effectId: "healer:action:1" }, ctx));
    expect(used.state.cards[ids.healer]?.resources).toBe(0);
    expect(used.state.cards[ids.other]?.resources).toBe(3);
    // Healing removes at most the damage there is, and the step records what came off as a negative amount (rr.damage).
    expect(used.state.cards[ids.other]?.damage).toBe(1);
    expect(used.steps.filter((step) => step.kind === "damage").map((step) => (step.kind === "damage" ? step.amount : 0))).toEqual([-2]);
    const poor = reduce(updateCard(state, ids.healer, { resources: 1 }), { type: "Trigger", cardId: ids.healer, effectId: "healer:action:1" }, ctx);
    expect(poor.ok).toBe(false);
  });

  it("a card flagged noThreat contributes nothing to the staging area's threat (rr.staging-area)", () => {
    const { state, ctx, ids } = table([]);
    expect(stagingThreat(state, ctx.cards)).toBe(3);
    const flagged = { ...state, modifiers: [{ instanceId: ids.foe, sourceId: ids.healer, stat: "noThreat" as const, amount: 1, until: "endOfPhase" as const }] };
    expect(stagingThreat(flagged, ctx.cards)).toBe(0);
  });

  it("a hero leaving play is announced to its player, unless that player is eliminated by it (rr.player-elimination)", () => {
    const { state, ctx, ids } = table([]);
    const steps: EngineStep[] = [];
    const one = destroyCard(state, ids.healer, ctx.cards, steps);
    expect(one.pendingEvents).toEqual([{ trigger: "heroLeftPlay", seat: 0, subject: ids.healer }]);
    const both = destroyCard(one, ids.other, ctx.cards, steps);
    expect(both.seats[0].eliminated).toBe(true);
    expect(both.pendingEvents).toHaveLength(1);
  });
});

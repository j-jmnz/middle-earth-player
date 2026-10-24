import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";

import { cardMap, expectOk, hero, idleScenario } from "./fixture.ts";
import type { EngineStep } from "./intents.ts";
import { settle } from "./machine.ts";
import { definePrinted } from "./printed.ts";
import { reduce } from "./reduce.ts";
import { updateCard } from "./state.ts";
import { fireForced } from "./triggers.ts";
import { spawn } from "./zones.ts";

const place = (code: string) => definePrinted({ code, name: code, type: "location", threat: 0 });

describe("cancel payments", () => {
  const elf = definePrinted({ code: "elf", name: "Elf", type: "treasure", attack: 1, defense: 1, health: 3 });
  const effect: Effect = {
    id: "elf:forced:1",
    cardCode: "elf",
    timing: "forced",
    trigger: "endOfPhase",
    cancel: { cost: 2, sphere: "fellowship" },
    instructions: [{ verb: "Discard", target: { kind: "self" } }],
  };

  function offered() {
    const ctx = { effects: [effect], cards: cardMap([hero("frodo", "fellowship"), hero("sam", "fellowship"), elf]) };
    let state = idleScenario(1);
    const frodo = spawn(state, "frodo", { zone: "heroes", seat: 0 });
    const sam = spawn(frodo.state, "sam", { zone: "heroes", seat: 0 });
    const gildor = spawn(sam.state, "elf", { zone: "play", seat: 0 });
    state = updateCard(updateCard(gildor.state, frodo.id, { resources: 1 }), sam.id, { resources: 1 });
    const settled = settle({ ...state, phase: "Travel" }, ctx, []);
    return { state: settled, ctx, frodo: frodo.id, sam: sam.id, elf: gildor.id };
  }

  it("refuses to spend one hero's resources twice", () => {
    const { state, ctx, frodo, elf: elfId } = offered();
    expect(state.window).toEqual({ kind: "cancelOffer", seat: 0 });
    const twice = reduce(
      state,
      { type: "Trigger", cardId: elfId, effectId: effect.id, payments: [{ heroId: frodo, amount: 1 }, { heroId: frodo, amount: 1 }] },
      ctx,
    );
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.reason).toBe("That hero does not have those resources");
  });

  it("accepts the same cost split across two heroes", () => {
    const { state, ctx, frodo, sam, elf: elfId } = offered();
    const paid = expectOk(
      reduce(
        state,
        { type: "Trigger", cardId: elfId, effectId: effect.id, payments: [{ heroId: frodo, amount: 1 }, { heroId: sam, amount: 1 }] },
        ctx,
      ),
    );
    expect(paid.state.cards[frodo]?.resources).toBe(0);
    expect(paid.state.cards[sam]?.resources).toBe(0);
    expect(paid.state.cards[elfId]?.zone).toBe("play");
  });
});

describe("revealed events", () => {
  it("only reach the card that was revealed", () => {
    const raise = (code: string, amount: number): Effect => ({
      id: `${code}:forced:1`,
      cardCode: code,
      timing: "forced",
      trigger: "revealed",
      instructions: [{ verb: "RaiseThreat", amount }],
    });
    const ctx = { effects: [raise("a", 1), raise("b", 2)], cards: cardMap([hero("frodo", "fellowship"), place("a"), place("b")]) };
    let state = idleScenario(1);
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    const a = spawn(state, "a", { zone: "staging" });
    const b = spawn(a.state, "b", { zone: "staging" });
    const steps: EngineStep[] = [];
    settle(fireForced(b.state, { trigger: "revealed", seat: 0, cardId: b.id }, ctx, steps), ctx, steps);
    const amounts = steps.flatMap((step) => (step.kind === "threat" ? [step.amount] : []));
    expect(amounts).toEqual([2]);
  });
});

describe("hide failures", () => {
  it("are dropped when the round advances", () => {
    const ctx = { effects: [], cards: cardMap([hero("frodo", "fellowship")]) };
    let state = idleScenario(1, "End of round");
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    state = {
      ...state,
      mode: "endRound",
      round: 1,
      hideFailures: [{ seat: 0, round: 1, phase: "Quest" }],
    };
    const next = settle(state, ctx, []);
    expect(next.round).toBe(2);
    expect(next.hideFailures).toEqual([]);
  });
});

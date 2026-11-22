import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";

import { holds } from "../interpret/conditions.ts";
import { placeProgress } from "../interpret/effect-verbs.ts";
import { spentThisRound } from "../families/costs/pay.ts";
import { cardMap, expectOk, hero, idleScenario } from "../core/test-fixture.ts";
import type { EngineStep } from "../core/intents.ts";
import { settle } from "./machine.ts";
import { definePrinted } from "../core/printed.ts";
import { reduce } from "./reduce.ts";
import { updateCard } from "../core/state.ts";
import { fireForced } from "../windows/triggers.ts";
import { spawn } from "../core/zones.ts";

const place = (code: string) => definePrinted({ code, name: code, type: "location", threat: 0 });

describe("cancel payments", () => {
  const elf = definePrinted({ code: "elf", name: "Elf", type: "treasure", attack: 1, defense: 1, health: 3 });
  const effect: Effect = {
    id: "elf:forced:1",
    cardCode: "elf", lines: ["fixture:A:1"],
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

  it("notes the pools that paid a cancel as spent this round, in a game that reads it (Tighten Our Belts)", () => {
    const { state, ctx, frodo, sam, elf: elfId } = offered();
    // A card in the game reads whether resources were spent (`unspent`), so spending is remembered.
    const reader: Effect = { id: "frodo:action:1", cardCode: "frodo", lines: ["frodo:A:1"], timing: "action", instructions: [{ verb: "HeroesGainResources", amount: 1, unspent: true }] };
    const reading = { ...ctx, effects: [effect, reader] };
    const paid = expectOk(reduce(state, { type: "Trigger", cardId: elfId, effectId: effect.id, payments: [{ heroId: frodo, amount: 1 }, { heroId: sam, amount: 1 }] }, reading));
    expect(spentThisRound(paid.state, frodo)).toBe(true);
    expect(spentThisRound(paid.state, sam)).toBe(true);
  });
});

describe("revealed events", () => {
  it("only reach the card that was revealed", () => {
    const raise = (code: string, amount: number): Effect => ({
      id: `${code}:forced:1`,
      cardCode: code, lines: ["fixture:A:1"],
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

describe("the refresh phase's last action window", () => {
  it("is still the refresh phase: a Refresh Action may be used after 7.4 (rr.step-7-4, rr.step-7-5)", () => {
    const state = { ...idleScenario(1), phase: "End of round" as const };
    const ctx = { effects: [], cards: cardMap([]) };
    expect(holds(state, { kind: "phase", is: "Refresh" }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(true);
    // An event about the end of a phase names the phase that ended.
    expect(holds(state, { kind: "phase", is: "Refresh" }, { actor: 0, sourceId: null, returned: 0, phase: "End of round" }, ctx)).toBe(false);
  });
});

describe("an explored location leaving play", () => {
  it("is announced as explored (rr.explored): a Response to it with subjectExplored is offered", () => {
    const glade = definePrinted({ code: "glade", name: "Glade", type: "location", threat: 1, questPoints: 2 });
    const scout: Effect = {
      id: "frodo:response:1",
      cardCode: "frodo",
      lines: ["frodo:A:1"],
      timing: "response",
      trigger: "leftPlay",
      subject: { type: "location", control: "any" },
      condition: { kind: "subjectExplored" },
      instructions: [{ verb: "Draw", amount: 1 }],
    };
    const ctx = { effects: [scout], cards: cardMap([hero("frodo", "fellowship"), glade]) };
    // The Response draws a card, so the deck holds one (a draw from an empty deck changes nothing, rr.running-out-of-cards).
    const frodo = spawn(spawn(idleScenario(1), "frodo", { zone: "deck", seat: 0 }).state, "frodo", { zone: "heroes", seat: 0 });
    const location = spawn(frodo.state, "glade", { zone: "activeLocation" });
    const steps: EngineStep[] = [];
    const explored = placeProgress({ ...location.state, activeLocation: location.id }, location.id, 2, ctx, steps);
    expect(explored.cards[location.id]?.zone).not.toBe("activeLocation");
    // The Response is offered: its condition held for the explored location.
    expect(explored.stack.at(-1)?.data.kind).toBe("responses");
  });
});

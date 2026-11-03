import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";

import { pushCardEffects } from "../interpret/effect-frames.ts";
import { cardMap, expectOk, hero, idleScenario } from "../core/test-fixture.ts";
import { advanceFrame } from "./frames.ts";
import type { EngineStep } from "../core/intents.ts";
import { legalIntents, reduce } from "../engine/reduce.ts";
import { definePrinted } from "../core/printed.ts";
import { settle } from "../engine/machine.ts";
import { updateCard } from "../core/state.ts";
import { fireForced, crossBoundary } from "./triggers.ts";
import { pushDue } from "./delayed.ts";
import { topFrame } from "./windows.ts";
import { spawn } from "../core/zones.ts";

function place(code: string) {
  return definePrinted({ code, name: code, type: "location", threat: 0 });
}

function threats(steps: readonly EngineStep[]): number[] {
  return steps.flatMap((step) => (step.kind === "threat" ? [step.amount] : []));
}

function frames(steps: readonly EngineStep[]): string[] {
  return steps.flatMap((step) => (step.kind === "push" || step.kind === "pop" ? [`${step.kind}:${step.frame}`] : []));
}

function raise(id: string, cardCode: string, timing: Effect["timing"], amount: number, extra: Partial<Effect> = {}): Effect {
  return { id, cardCode, lines: ["fixture:A:1"], timing, instructions: [{ verb: "RaiseThreat", amount }], ...extra };
}

describe("forced effects", () => {
  it("resolve a triggered effect first, then Forced effects oldest first, each in its own frame", () => {
    const effects: Effect[] = [
      raise("a:forced:1", "a", "forced", 1, { trigger: "hideFailed" }),
      raise("b:forced:1", "b", "forced", 2, { trigger: "hideFailed" }),
      raise("q:triggered:1", "q", "triggered", 3, { trigger: "hideFailed" }),
    ];
    const cards = cardMap([hero("frodo", "fellowship"), place("a"), place("b"), place("q")]);
    const ctx = { effects, cards };
    let state = idleScenario(1);
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    // b entered play before a, and q last.
    state = spawn(state, "b", { zone: "staging" }).state;
    state = spawn(state, "a", { zone: "staging" }).state;
    state = spawn(state, "q", { zone: "staging" }).state;
    const steps: EngineStep[] = [];
    const settled = settle(fireForced(state, { trigger: "hideFailed", seat: 0 }, ctx, steps), ctx, steps);
    expect(threats(steps)).toEqual([3, 2, 1]);
    expect(frames(steps)).toEqual([
      "push:event",
      "push:forced",
      "pop:forced",
      "push:forced",
      "push:forced",
      "pop:forced",
      "pop:forced",
      "pop:event",
    ]);
    expect(settled.stack).toEqual([]);
  });

  it("ignore a card that is not in play and a different event", () => {
    const effects: Effect[] = [raise("a:forced:1", "a", "forced", 1, { trigger: "hideFailed" })];
    const ctx = { effects, cards: cardMap([hero("frodo", "fellowship"), place("a")]) };
    let state = idleScenario(1);
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "a", { zone: "encounterDeck" }).state;
    const steps: EngineStep[] = [];
    expect(fireForced(state, { trigger: "hideFailed", seat: 0 }, ctx, steps)).toBe(state);
    const inPlay = spawn(state, "a", { zone: "staging" }).state;
    expect(fireForced(inPlay, { trigger: "revealed", seat: 0 }, ctx, steps)).toBe(inPlay);
    expect(steps).toEqual([]);
  });

  it("fire at the end of a phase, before the delayed effects of that phase", () => {
    const effects: Effect[] = [
      raise("a:forced:1", "a", "forced", 1, { trigger: "endOfPhase", condition: { kind: "phase", is: "Quest" } }),
      raise("b:forced:1", "b", "forced", 5, { trigger: "endOfPhase", condition: { kind: "phase", is: "Refresh" } }),
    ];
    const ctx = { effects, cards: cardMap([hero("frodo", "fellowship"), place("a"), place("b")]) };
    let state = idleScenario(1, "Quest");
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "a", { zone: "staging" }).state;
    state = spawn(state, "b", { zone: "staging" }).state;
    state = {
      ...state,
      delayed: [
        {
          id: "d0",
          until: "endOfPhase",
          sourceId: null,
          seat: 0,
          phase: "Quest",
          instructions: [{ verb: "RaiseThreat", amount: 2 }],
          uncancelable: null,
        },
      ],
    };
    const steps: EngineStep[] = [];
    // Still in the Quest phase: nothing fires.
    expect(settle(state, ctx, steps)).toBe(state);
    const crossed = settle({ ...state, phase: "Travel", mode: "stopped" }, ctx, steps);
    expect(threats(steps)).toEqual([1, 2]);
    expect(crossed.delayed).toEqual([]);
    expect(crossed.boundaryPhase).toBe("Travel");
  });

  it("fire an end-of-round effect only when the End of round phase finishes", () => {
    const effects: Effect[] = [raise("a:forced:1", "a", "forced", 1, { trigger: "endOfRound" })];
    const ctx = { effects, cards: cardMap([hero("frodo", "fellowship"), place("a")]) };
    let state = idleScenario(1, "Refresh");
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "a", { zone: "staging" }).state;
    const steps: EngineStep[] = [];
    const inEnd = settle({ ...state, phase: "End of round" }, ctx, steps);
    expect(threats(steps)).toEqual([]);
    settle({ ...inEnd, phase: "Beginning of round" }, ctx, steps);
    expect(threats(steps)).toEqual([1]);
  });
});

describe("revealed events", () => {
  it("fire Forced effects on a revealed card after its When Revealed, inside the reveal frame", () => {
    const effects: Effect[] = [
      raise("r:whenRevealed:1", "r", "whenRevealed", 1),
      raise("r:forced:1", "r", "forced", 2, { trigger: "revealed" }),
    ];
    const ctx = { effects, cards: cardMap([hero("frodo", "fellowship"), place("r")]) };
    let state = idleScenario(1);
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "r", { zone: "encounterDeck" }).state;
    state = { ...state, mode: "questCommit", phase: "Quest", window: { kind: "pass" }, activeSeat: 0 };
    const result = expectOk(reduce(state, { type: "Pass" }, ctx));
    expect(threats(result.steps)).toEqual([1, 2]);
    expect(frames(result.steps)).toEqual([
      "push:reveal",
      "push:whenRevealed",
      "pop:whenRevealed",
      "push:forced",
      "pop:forced",
      "pop:reveal",
    ]);
  });
});

describe("each player", () => {
  const ask = (order: "lastFirst" | "firstFirst") => {
    const effect: Effect = {
      id: "pick:whenRevealed:1",
      cardCode: "pick", lines: ["fixture:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order,
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "a", instructions: [] },
                { id: "b", instructions: [] },
              ],
            },
          ],
        },
      ],
    };
    const ctx = { effects: [effect], cards: cardMap([hero("frodo", "fellowship"), hero("pip", "tactics"), place("pick")]) };
    let state = idleScenario(2);
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "pip", { zone: "heroes", seat: 1 }).state;
    const source = spawn(state, "pick", { zone: "staging" });
    const steps: EngineStep[] = [];
    let current = settle(pushCardEffects(source.state, "whenRevealed", source.id, 0, false, [effect], ctx, steps), ctx, steps);
    const seats: number[] = [];
    for (let guard = 0; guard < 4 && current.window?.kind === "choose"; guard += 1) {
      seats.push(current.window.seat);
      current = expectOk(reduce(current, { type: "Choose", optionId: "a" }, ctx)).state;
    }
    return seats;
  };

  it("start with the last player, or the first player when asked", () => {
    expect(ask("lastFirst")).toEqual([1, 0]);
    expect(ask("firstFirst")).toEqual([0, 1]);
  });
});

describe("delayed effects", () => {
  it("evaluate the uncancelable condition when the effect starts", () => {
    const ring = definePrinted({ code: "ring", name: "Ring", type: "objective" });
    const ctx = { effects: [], cards: cardMap([hero("frodo", "fellowship"), ring]) };
    let state = idleScenario(1);
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    const ringSpawn = spawn(state, "ring", { zone: "play", seat: 0 });
    state = {
      ...ringSpawn.state,
      delayed: [
        {
          id: "d0",
          until: "endOfPhase",
          sourceId: null,
          seat: 0,
          phase: "Quest",
          instructions: [{ verb: "RaiseThreat", amount: 1 }],
          uncancelable: { kind: "exhausted", code: "ring", is: true },
        },
      ],
    };
    const flag = (current: typeof state): boolean | null => {
      const steps: EngineStep[] = [];
      const pushed = pushDue(current, "Quest", "endOfPhase", steps);
      const begun = advanceFrame(pushed, ctx, steps);
      const data = topFrame(begun)?.data;
      return data?.kind === "effect" ? data.uncancelable : null;
    };
    expect(flag(state)).toBe(false);
    expect(flag(updateCard(state, ringSpawn.id, { exhausted: true }))).toBe(true);
  });

  it("do not come due for another phase or in the same phase", () => {
    const ctx = { effects: [], cards: cardMap([hero("frodo", "fellowship")]) };
    const state = {
      ...idleScenario(1),
      delayed: [
        {
          id: "d0",
          until: "endOfPhase" as const,
          sourceId: null,
          seat: 0,
          phase: "Quest",
          instructions: [{ verb: "RaiseThreat" as const, amount: 1 }],
          uncancelable: null,
        },
      ],
    };
    const steps: EngineStep[] = [];
    expect(pushDue(state, "Planning", "endOfPhase", steps)).toBe(state);
    expect(crossBoundary(state, ctx, steps)).toBe(state);
  });
});

describe("cancel offers", () => {
  const elf = definePrinted({ code: "elf", name: "Elf", type: "treasure", attack: 1, defense: 1, health: 3 });
  const ring = definePrinted({ code: "ring", name: "Ring", type: "objective" });
  const gildorLike = (extra: Partial<Effect> = {}): Effect => ({
    id: "elf:forced:1",
    cardCode: "elf", lines: ["fixture:A:1"],
    timing: "forced",
    trigger: "endOfPhase",
    cancel: { cost: 1, sphere: "fellowship", ...extra.cancel },
    instructions: [{ verb: "Discard", target: { kind: "self" } }],
  });

  function offered(resources: number, effect: Effect, ringExhausted = false) {
    const cards = cardMap([hero("frodo", "fellowship"), hero("pip", "tactics"), elf, ring]);
    const ctx = { effects: [effect], cards };
    let state = idleScenario(1);
    const frodo = spawn(state, "frodo", { zone: "heroes", seat: 0 });
    const pip = spawn(frodo.state, "pip", { zone: "heroes", seat: 0 });
    const gildor = spawn(pip.state, "elf", { zone: "play", seat: 0 });
    const theRing = spawn(gildor.state, "ring", { zone: "play", seat: 0 });
    state = updateCard(theRing.state, frodo.id, { resources });
    state = updateCard(state, pip.id, { resources: 3 });
    state = updateCard(state, theRing.id, { exhausted: ringExhausted });
    const steps: EngineStep[] = [];
    const settled = settle({ ...state, phase: "Travel" }, ctx, steps);
    return { state: settled, ctx, ids: { frodo: frodo.id, pip: pip.id, elf: gildor.id }, steps };
  }

  it("lets the first player pay and keep the card", () => {
    const { state, ctx, ids } = offered(1, gildorLike());
    expect(state.window).toEqual({ kind: "cancelOffer", seat: 0 });
    expect(legalIntents(state, ctx)).toEqual([
      { type: "Pass" },
      { type: "Trigger", cardId: ids.elf, effectId: "elf:forced:1" },
    ]);
    const wrongSphere = reduce(state, { type: "Trigger", cardId: ids.elf, effectId: "elf:forced:1", payments: [{ heroId: ids.pip, amount: 1 }] }, ctx);
    expect(wrongSphere.ok).toBe(false);
    if (!wrongSphere.ok) expect(wrongSphere.reason).toBe("Wrong sphere");
    const short = reduce(state, { type: "Trigger", cardId: ids.elf, effectId: "elf:forced:1", payments: [] }, ctx);
    if (!short.ok) expect(short.reason).toBe("Underpay");
    expect(short.ok).toBe(false);
    const over = reduce(state, { type: "Trigger", cardId: ids.elf, effectId: "elf:forced:1", payments: [{ heroId: ids.frodo, amount: 2 }] }, ctx);
    expect(over.ok).toBe(false);
    const paid = expectOk(reduce(state, { type: "Trigger", cardId: ids.elf, effectId: "elf:forced:1", payments: [{ heroId: ids.frodo, amount: 1 }] }, ctx));
    expect(paid.state.cards[ids.frodo]?.resources).toBe(0);
    expect(paid.state.cards[ids.elf]?.zone).toBe("play");
    expect(paid.steps).toContainEqual({ kind: "cancel", cardId: ids.elf });
    expect(paid.state.stack).toEqual([]);
    expect(paid.state.window).toBeNull();
  });

  it("goes ahead when the first player passes", () => {
    const { state, ctx, ids } = offered(1, gildorLike());
    const passed = expectOk(reduce(state, { type: "Pass" }, ctx));
    expect(passed.state.cards[ids.elf]?.zone).toBe("discard");
    expect(passed.state.cards[ids.frodo]?.resources).toBe(1);
    expect(passed.state.stack).toEqual([]);
  });

  it("offers nothing when no hero can pay", () => {
    const { state, ids } = offered(0, gildorLike());
    expect(state.window).toBeNull();
    expect(state.cards[ids.elf]?.zone).toBe("discard");
  });

  it("offers nothing while the condition that blocks a cancel holds", () => {
    const blocked = gildorLike({ cancel: { cost: 1, sphere: "fellowship", unless: { kind: "exhausted", code: "ring", is: true } } });
    const exhausted = offered(1, blocked, true);
    expect(exhausted.state.window).toBeNull();
    expect(exhausted.state.cards[exhausted.ids.elf]?.zone).toBe("discard");
    const ready = offered(1, blocked, false);
    expect(ready.state.window).toEqual({ kind: "cancelOffer", seat: 0 });
  });
});

describe("choices", () => {
  const card = definePrinted({ code: "pick", name: "Pick", type: "treachery" });
  const effect: Effect = {
    id: "pick:whenRevealed:1",
    cardCode: "pick", lines: ["fixture:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "one", instructions: [{ verb: "RaiseThreat", amount: 1 }] },
          { id: "two", instructions: [{ verb: "RaiseThreat", amount: 2 }] },
          { id: "never", requires: { kind: "hasEngaged", trait: "Nazgûl" }, instructions: [] },
        ],
      },
    ],
  };

  function asked() {
    const ctx = { effects: [effect], cards: cardMap([hero("frodo", "fellowship"), hero("pip", "tactics"), card]) };
    let state = idleScenario(2);
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "pip", { zone: "heroes", seat: 1 }).state;
    const source = spawn(state, "pick", { zone: "staging" });
    const steps: EngineStep[] = [];
    const pushed = pushCardEffects(source.state, "whenRevealed", source.id, 1, false, [effect], ctx, steps);
    return { state: settle(pushed, ctx, steps), ctx };
  }

  it("lists only the options whose requirement holds and resumes on the chosen one", () => {
    const { state, ctx } = asked();
    expect(state.window).toEqual({ kind: "choose", seat: 1, options: ["one", "two"] });
    expect(state.activeSeat).toBe(1);
    expect(legalIntents(state, ctx)).toEqual([
      { type: "Choose", optionId: "one" },
      { type: "Choose", optionId: "two" },
    ]);
    const refused = reduce(state, { type: "Choose", optionId: "never" }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("That is not one of the choices");
    const chosen = expectOk(reduce(state, { type: "Choose", optionId: "two" }, ctx));
    expect(threats(chosen.steps)).toEqual([2]);
    expect(chosen.state.window).toBeNull();
    expect(chosen.state.stack).toEqual([]);
    expect(chosen.state.seats[1]?.threat).toBe(2);
  });

  it("is not blocked by Peril for the seat that must choose", () => {
    const { state, ctx } = asked();
    const perilous = { ...state, perilSeat: 0 };
    expectOk(reduce(perilous, { type: "Choose", optionId: "one" }, ctx));
  });
});

describe("immediate attacks", () => {
  it("wait for the defense window and do not use up the enemy's attack for the phase", () => {
    const orc = definePrinted({
      code: "orc",
      name: "Orc",
      type: "enemy",
      attack: 2,
      defense: 0,
      health: 5,
      engagementCost: 20,
      threat: 1,
    });
    const effect: Effect = {
      id: "orc:forced:1",
      cardCode: "orc", lines: ["fixture:A:1"],
      timing: "forced",
      trigger: "hideFailed",
      condition: { kind: "engagedWithActor" },
      instructions: [{ verb: "ImmediateAttack" }],
    };
    const ctx = { effects: [effect], cards: cardMap([hero("frodo", "fellowship"), orc]) };
    let state = idleScenario(2);
    const frodo = spawn(state, "frodo", { zone: "heroes", seat: 0 });
    const engaged = spawn(frodo.state, "orc", { zone: "engaged", seat: 0 });
    const staged = spawn(engaged.state, "orc", { zone: "staging" });
    state = staged.state;
    const steps: EngineStep[] = [];
    // Seat 1 failed: the enemy is engaged with seat 0, so its condition fails.
    expect(fireForced(state, { trigger: "hideFailed", seat: 1 }, ctx, steps)).toBe(state);
    const settled = settle(fireForced(state, { trigger: "hideFailed", seat: 0 }, ctx, steps), ctx, steps);
    expect(settled.window).toEqual({ kind: "defense", enemyId: engaged.id, seat: 0 });
    expect(settled.pendingAttack).toEqual({ enemyId: engaged.id, seat: 0, immediate: true });
    expect(legalIntents(settled, ctx)).toEqual([{ type: "DeclareDefender" }, { type: "Undefended" }]);
    const hit = expectOk(reduce(settled, { type: "Undefended" }, ctx));
    expect(hit.state.cards[frodo.id]?.damage).toBe(2);
    expect(hit.state.resolvedAttacks).toEqual([]);
    expect(hit.state.pendingAttack).toBeNull();
    expect(hit.state.stack).toEqual([]);
  });
});


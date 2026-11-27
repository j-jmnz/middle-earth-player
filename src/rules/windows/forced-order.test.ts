// Rules: rr.forced, rr.limits, rr.response (data/rules/entries.json). The first player's choice of the order the Forced effects of one moment initiate in (OrderForced, families/encounter/forced-order.ts): when a window opens and when it does not,
// what the cards print holds back (`early`, `afterForcedOn`), a limit spent as the effect triggers, and the lasting effects that lapse as a phase or round ends holding for the Forced effects and the Responses at that end.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { cardMap, hero, idleScenario } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import type { EngineStep } from "../core/intents.ts";
import { settle } from "../engine/machine.ts";
import type { ScenarioState } from "../core/state.ts";
import { spawn } from "../core/zones.ts";
import { pushEffectFrame } from "../interpret/effect-frames.ts";
import { applyChoice } from "./choices.ts";
import { crossBoundary, fireForced } from "./triggers.ts";

const place = (code: string) => definePrinted({ code, name: code, type: "location", threat: 0 });
const threats = (steps: readonly EngineStep[]): number[] => steps.flatMap((step) => (step.kind === "threat" ? [step.amount] : []));
const forced = (id: string, cardCode: string, amount: number, extra: Partial<Effect> = {}): Effect => ({ id, cardCode, lines: ["fixture:A:1"], timing: "forced", trigger: "hideFailed", instructions: [{ verb: "RaiseThreat", amount }], ...extra });
const EVENT = { trigger: "hideFailed", seat: 0 } as const;

// The staging area holds `codes` oldest first, after a hero.
function table(codes: readonly string[], effects: readonly Effect[]) {
  const ctx = { effects, cards: cardMap([hero("frodo", "fellowship"), hero("r", "fellowship"), ...[...new Set(codes)].map(place)]) };
  let state = spawn(idleScenario(1), "frodo", { zone: "heroes", seat: 0 }).state;
  for (const code of codes) state = spawn(state, code, { zone: "staging" }).state;
  return { ctx, state };
}
const asked = (state: ScenarioState): readonly string[] => (state.window?.kind === "choose" ? state.window.options : []);
const codesOf = (state: ScenarioState, ids: readonly string[]): (string | undefined)[] => ids.map((id) => state.cards[id]?.code);

describe("the order window opens only when the Forced effects differ", () => {
  it("two copies of one card ask nothing: both resolve, oldest first", () => {
    const { ctx, state } = table(["a", "a"], [forced("a:forced:1", "a", 1)]);
    const steps: EngineStep[] = [];
    const done = settle(fireForced(state, EVENT, ctx, steps), ctx, steps);
    expect(done.window).toBeNull();
    expect(threats(steps)).toEqual([1, 1]);
  });

  it("two effects of one card ask nothing: both resolve in the order of the record", () => {
    const { ctx, state } = table(["a"], [forced("a:forced:1", "a", 1), forced("a:forced:2", "a", 2)]);
    const steps: EngineStep[] = [];
    const done = settle(fireForced(state, EVENT, ctx, steps), ctx, steps);
    expect(done.window).toBeNull();
    expect(threats(steps)).toEqual([1, 2]);
  });

  it("one effect asks nothing", () => {
    const { ctx, state } = table(["a"], [forced("a:forced:1", "a", 1)]);
    const steps: EngineStep[] = [];
    const done = settle(fireForced(state, EVENT, ctx, steps), ctx, steps);
    expect(done.window).toBeNull();
    expect(threats(steps)).toEqual([1]);
  });

  it("copies of one card and another card ask once between the two kinds, then resolve the rest on their own", () => {
    const { ctx, state } = table(["a", "b", "a"], [forced("a:forced:1", "a", 1), forced("b:forced:1", "b", 2)]);
    const steps: EngineStep[] = [];
    const question = settle(fireForced(state, EVENT, ctx, steps), ctx, steps);
    expect(codesOf(question, asked(question))).toEqual(["a", "b"]);
    const done = settle(applyChoice(question, asked(question)[1] ?? ""), ctx, steps);
    expect(done.window).toBeNull();
    expect(threats(steps)).toEqual([2, 1, 1]);
  });
});

describe("what the cards print holds an order back", () => {
  it("an early effect initiates before the rest and is never an option", () => {
    const { ctx, state } = table(["b", "c", "a"], [forced("a:forced:1", "a", 1, { early: true }), forced("b:forced:1", "b", 2), forced("c:forced:1", "c", 3)]);
    const steps: EngineStep[] = [];
    const question = settle(fireForced(state, EVENT, ctx, steps), ctx, steps);
    expect(threats(steps)).toEqual([1]);
    expect(codesOf(question, asked(question))).toEqual(["b", "c"]);
    settle(applyChoice(question, asked(question)[1] ?? ""), ctx, steps);
    expect(threats(steps)).toEqual([1, 3, 2]);
  });

  it("an effect printed \"after resolving the Forced effect on\" a card waits for that card's effects", () => {
    const { ctx, state } = table(["a", "b", "c"], [forced("a:forced:1", "a", 1, { afterForcedOn: "b" }), forced("b:forced:1", "b", 2), forced("c:forced:1", "c", 3)]);
    const steps: EngineStep[] = [];
    const question = settle(fireForced(state, EVENT, ctx, steps), ctx, steps);
    // a is not offered while b has effects left; the first player picks c, then b is taken on its own, then a.
    expect(codesOf(question, asked(question))).toEqual(["b", "c"]);
    const done = settle(applyChoice(question, asked(question)[1] ?? ""), ctx, steps);
    expect(done.window).toBeNull();
    expect(threats(steps)).toEqual([3, 2, 1]);
  });

  it("with only the waiting effect and the card it waits for, no question is asked", () => {
    const { ctx, state } = table(["a", "b"], [forced("a:forced:1", "a", 1, { afterForcedOn: "b" }), forced("b:forced:1", "b", 2)]);
    const steps: EngineStep[] = [];
    const done = settle(fireForced(state, EVENT, ctx, steps), ctx, steps);
    expect(done.window).toBeNull();
    expect(threats(steps)).toEqual([2, 1]);
  });
});

describe("a limit is spent as the effect triggers", () => {
  it("an effect that waits for the order has its use recorded, so it cannot trigger a second time meanwhile", () => {
    const { ctx, state } = table(["a", "b"], [forced("a:forced:1", "a", 1, { limit: "oncePerRound" }), forced("b:forced:1", "b", 2)]);
    const steps: EngineStep[] = [];
    const question = settle(fireForced(state, EVENT, ctx, steps), ctx, steps);
    expect(question.uses.filter((use) => use.effectId === "a:forced:1")).toHaveLength(1);
    // The same moment comes again before the first player has answered: a's use is spent, only b is left to resolve.
    const again = settle(fireForced(question, EVENT, ctx, steps), ctx, steps);
    expect(again.uses.filter((use) => use.effectId === "a:forced:1")).toHaveLength(1);
    const done = settle(applyChoice(question, asked(question)[0] ?? ""), ctx, steps);
    expect(done.uses.filter((use) => use.effectId === "a:forced:1")).toHaveLength(1);
  });
});

describe("OrderForced", () => {
  it("throws when its frame has lost the event", () => {
    const { ctx, state } = table(["a", "b"], [forced("a:forced:1", "a", 1), forced("b:forced:1", "b", 2)]);
    const [a, b] = Object.values(state.cards).filter((card) => card.zone === "staging");
    const broken = pushEffectFrame(
      state,
      { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "a:forced:1", instructions: [{ verb: "OrderForced", entries: [{ effectId: "a:forced:1", sourceId: a?.id ?? "" }, { effectId: "b:forced:1", sourceId: b?.id ?? "" }] }], cancel: null, blockCancel: null },
      [],
    );
    expect(() => settle(broken, ctx, [])).toThrow("OrderForced lost its event");
  });
});

describe("a lasting effect that lapses as the round ends holds for the Responses and the Forced effects at that end", () => {
  // "Response: At the end of each round, ..." (41050:A:3): the same lapse that keeps a Forced effect from firing keeps a Response from being offered.
  const response: Effect = { id: "r:response:1", cardCode: "r", lines: ["fixture:A:1"], timing: "response", trigger: "endOfRound", instructions: [{ verb: "RaiseThreat", amount: 1 }] };
  const ended = (lapsed: boolean) => {
    const { ctx, state } = table([], [response]);
    const bearer = spawn(state, "r", { zone: "heroes", seat: 0 });
    const blank = { instanceId: bearer.id, sourceId: bearer.id, stat: "blankText" as const, amount: 1, until: "endOfRound" as const };
    const start: ScenarioState = { ...bearer.state, phase: "End of round", boundaryPhase: "End of round", ...(lapsed ? { lapsedModifiers: [blank] } : {}) };
    const steps: EngineStep[] = [];
    return settle(crossBoundary({ ...start, phase: "Beginning of round", mode: "beginRound" }, ctx, steps), ctx, steps);
  };

  it("offers the Response with nothing lapsed", () => {
    expect(ended(false).window).toMatchObject({ kind: "response" });
  });

  it("does not offer it while the lapsed effect blanks the card's text", () => {
    expect(ended(true).window).not.toMatchObject({ kind: "response" });
  });
});

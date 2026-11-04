import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";

import { cardMap, expectOk, hero, idleScenario } from "../core/test-fixture.ts";
import type { EngineStep } from "../core/intents.ts";
import { settle } from "../engine/machine.ts";
import { definePrinted } from "../core/printed.ts";
import { legalIntents, reduce, type ReduceContext, type ScenarioState } from "../engine/reduce.ts";
import { offerResponses } from "../windows/responses.ts";
import { updateCard } from "../core/state.ts";
import { pruneRoundRecords } from "../quest/hide.ts";
import { attachTo, spawn } from "../core/zones.ts";

const gadget = definePrinted({ code: "gadget", name: "Gadget", type: "attachment", sphere: "leadership", cost: 0 });
const cards = cardMap([hero("lead", "leadership"), hero("tact", "tactics"), gadget]);

function action(extra: Partial<Effect> = {}): Effect {
  return { id: "gadget:action:1", cardCode: "gadget", lines: ["fixture:A:1"], timing: "action", instructions: [{ verb: "RaiseThreat", amount: 1 }], ...extra };
}

function table(effects: readonly Effect[], resources = { lead: 0, tact: 0 }) {
  let state = idleScenario(1, "Resource");
  const lead = spawn(state, "lead", { zone: "heroes", seat: 0 });
  const tact = spawn(lead.state, "tact", { zone: "heroes", seat: 0 });
  const item = spawn(tact.state, "gadget", { zone: "play", seat: 0 });
  state = attachTo(item.state, item.id, lead.id);
  state = updateCard(updateCard(state, lead.id, { resources: resources.lead }), tact.id, { resources: resources.tact });
  state = { ...state, mode: "resourceActions", window: { kind: "pass" }, activeSeat: 0 };
  const ctx: ReduceContext = { effects, cards };
  return { state, ctx, ids: { lead: lead.id, tact: tact.id, gadget: item.id } };
}

function trigger(ids: { gadget: string }, payments?: { heroId: string; amount: number }[]) {
  return { type: "Trigger" as const, cardId: ids.gadget, effectId: "gadget:action:1", ...(payments ? { payments } : {}) };
}

function offered(state: ScenarioState, ctx: ReduceContext): boolean {
  return legalIntents(state, ctx).some((intent) => intent.type === "Trigger");
}

describe("Action costs", () => {
  it("exhaustSelf needs a ready card, exhausts it, and is refused once spent", () => {
    const { state, ctx, ids } = table([action({ cost: { kind: "exhaustSelf" } })]);
    expect(offered(state, ctx)).toBe(true);
    const used = expectOk(reduce(state, trigger(ids), ctx));
    expect(used.state.cards[ids.gadget]?.exhausted).toBe(true);
    expect(used.state.seats[0].threat).toBe(1);
    expect(offered(used.state, ctx)).toBe(false);
    const again = reduce(used.state, trigger(ids), ctx);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("That cost cannot be paid");
  });

  it("addSelfToVictory and discardSelf move the card before the effect resolves", () => {
    const toVictory = table([action({ cost: { kind: "addSelfToVictory" } })]);
    const won = expectOk(reduce(toVictory.state, trigger(toVictory.ids), toVictory.ctx));
    expect(won.state.cards[toVictory.ids.gadget]?.zone).toBe("victory");
    expect(won.state.seats[0].threat).toBe(1);
    const discard = table([action({ cost: { kind: "discardSelf" } })]);
    const gone = expectOk(reduce(discard.state, trigger(discard.ids), discard.ctx));
    expect(gone.state.cards[discard.ids.gadget]?.zone).toBe("discard");
  });

  it("resources must be paid exactly, from heroes of the right sphere, once", () => {
    const effect = action({ cost: { kind: "resources", amount: 2, sphere: "leadership" } });
    const { state, ctx, ids } = table([effect], { lead: 1, tact: 5 });
    const reason = (payments: { heroId: string; amount: number }[]) => {
      const result = reduce(state, trigger(ids, payments), ctx);
      return result.ok ? null : result.reason;
    };
    // The leadership pool holds 1: not enough to offer the Action.
    expect(offered(state, ctx)).toBe(false);
    expect(reason([{ heroId: ids.lead, amount: 2 }])).toBe("That hero does not have those resources");
    const rich = table([effect], { lead: 3, tact: 5 });
    expect(offered(rich.state, rich.ctx)).toBe(true);
    const check = (payments: { heroId: string; amount: number }[]) => {
      const result = reduce(rich.state, trigger(rich.ids, payments), rich.ctx);
      return result.ok ? null : result.reason;
    };
    expect(check([])).toBe("Underpay");
    expect(check([{ heroId: rich.ids.lead, amount: 1 }])).toBe("Underpay");
    expect(check([{ heroId: rich.ids.lead, amount: 4 }])).toBe("That hero does not have those resources");
    expect(check([{ heroId: rich.ids.lead, amount: 3 }])).toBe("Overpay");
    expect(check([{ heroId: rich.ids.lead, amount: 1 }, { heroId: rich.ids.tact, amount: 1 }])).toBe("Wrong sphere");
    expect(check([{ heroId: rich.ids.lead, amount: -1 }])).toBe("That payment is not a cost");
    const paid = expectOk(reduce(rich.state, trigger(rich.ids, [{ heroId: rich.ids.lead, amount: 1 }, { heroId: rich.ids.lead, amount: 1 }]), rich.ctx));
    expect(paid.state.cards[rich.ids.lead]?.resources).toBe(1);
    expect(paid.state.cards[rich.ids.tact]?.resources).toBe(5);
  });

  it("refuses payments toward an effect with no resource cost", () => {
    const { state, ctx, ids } = table([action()], { lead: 3, tact: 0 });
    const result = reduce(state, trigger(ids, [{ heroId: ids.lead, amount: 1 }]), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("That effect has no resource cost");
  });

  it("opens the window again when the effect is done, with every seat able to pass again", () => {
    const { state, ctx, ids } = table([action()]);
    const steps = expectOk(reduce(state, trigger(ids), ctx));
    expect(steps.state.window).toEqual({ kind: "pass" });
    expect(steps.state.passed).toEqual([]);
    expect(steps.state.stack).toEqual([]);
  });
});

describe("limits", () => {
  it("oncePerRound blocks a second use in the round and allows one in the next", () => {
    const { state, ctx, ids } = table([action({ limit: "oncePerRound" })]);
    const used = expectOk(reduce(state, trigger(ids), ctx));
    expect(used.state.uses).toHaveLength(1);
    expect(offered(used.state, ctx)).toBe(false);
    const again = reduce(used.state, trigger(ids), ctx);
    if (!again.ok) expect(again.reason).toBe("That effect has already been used");
    expect(again.ok).toBe(false);
    // A later phase of the same round is still the same round.
    expect(offered({ ...used.state, phase: "Planning" }, ctx)).toBe(false);
    const next = pruneRoundRecords({ ...used.state, round: used.state.round + 1 });
    expect(next.uses).toEqual([]);
    expect(offered(next, ctx)).toBe(true);
  });

  it("oncePerPhase allows another use in a later phase of the same round", () => {
    const { state, ctx, ids } = table([action({ limit: "oncePerPhase" })]);
    const used = expectOk(reduce(state, trigger(ids), ctx));
    expect(offered(used.state, ctx)).toBe(false);
    expect(offered({ ...used.state, phase: "Planning" }, ctx)).toBe(true);
  });

  it("a limit is per card: a second copy has its own use", () => {
    const { state, ctx, ids } = table([action({ limit: "oncePerRound" })]);
    const second = spawn(state, "gadget", { zone: "play", seat: 0 });
    const used = expectOk(reduce(second.state, trigger(ids), ctx));
    const intents = legalIntents(used.state, ctx).filter((intent) => intent.type === "Trigger");
    expect(intents).toEqual([{ type: "Trigger", cardId: second.id, effectId: "gadget:action:1" }]);
  });
});

describe("Responses", () => {
  const response = (id: string, extra: Partial<Effect> = {}): Effect => ({
    id,
    cardCode: "gadget", lines: ["fixture:A:1"],
    timing: "response",
    trigger: "hideSucceeded",
    instructions: [{ verb: "RaiseThreat", amount: 1 }],
    ...extra,
  });

  function open(effects: readonly Effect[]) {
    const t = table(effects);
    const steps: EngineStep[] = [];
    const framed = offerResponses({ ...t.state, window: null }, { trigger: "hideSucceeded", seat: 0 }, t.ctx, steps);
    return { ...t, state: settle(framed, t.ctx, steps) };
  }

  it("are offered in a window that can be passed, and the pass closes the frame", () => {
    const { state, ctx, ids } = open([response("gadget:response:1")]);
    expect(state.window).toEqual({ kind: "response", seat: 0 });
    expect(legalIntents(state, ctx)).toEqual([{ type: "Pass" }, { type: "Trigger", cardId: ids.gadget, effectId: "gadget:response:1" }]);
    const passed = expectOk(reduce(state, { type: "Pass" }, ctx));
    expect(passed.state.stack).toEqual([]);
    expect(passed.state.seats[0].threat).toBe(0);
  });

  it("are not offered for a different event, or when nothing can pay", () => {
    const t = table([response("gadget:response:1", { cost: { kind: "resources", amount: 1, sphere: "leadership" } })]);
    const steps: EngineStep[] = [];
    expect(offerResponses(t.state, { trigger: "traveled", seat: 0 }, t.ctx, steps)).toBe(t.state);
    expect(offerResponses(t.state, { trigger: "hideSucceeded", seat: 0 }, t.ctx, steps)).toBe(t.state);
  });

  it("offer the next Response again after one is used, and a used limit is not offered", () => {
    const { state, ctx, ids } = open([response("gadget:response:1", { limit: "oncePerRound" }), response("gadget:response:2")]);
    const used = expectOk(reduce(state, { type: "Trigger", cardId: ids.gadget, effectId: "gadget:response:1" }, ctx));
    expect(used.state.seats[0].threat).toBe(1);
    expect(used.state.window).toEqual({ kind: "response", seat: 0 });
    expect(legalIntents(used.state, ctx)).toEqual([{ type: "Pass" }, { type: "Trigger", cardId: ids.gadget, effectId: "gadget:response:2" }]);
    const second = expectOk(reduce(used.state, { type: "Trigger", cardId: ids.gadget, effectId: "gadget:response:2" }, ctx));
    expect(second.state.seats[0].threat).toBe(2);
    expect(second.state.stack).toEqual([]);
    // The next event: the limited Response is spent for the round.
    const steps: EngineStep[] = [];
    const again = settle(offerResponses({ ...second.state, window: null }, { trigger: "hideSucceeded", seat: 0 }, ctx, steps), ctx, steps);
    expect(legalIntents(again, ctx)).toEqual([{ type: "Pass" }, { type: "Trigger", cardId: ids.gadget, effectId: "gadget:response:2" }]);
  });

  it("charge their cost when triggered", () => {
    const t = table([response("gadget:response:1", { cost: { kind: "exhaustSelf" } })]);
    const steps: EngineStep[] = [];
    const framed = settle(offerResponses({ ...t.state, window: null }, { trigger: "hideSucceeded", seat: 0 }, t.ctx, steps), t.ctx, steps);
    const used = expectOk(reduce(framed, { type: "Trigger", cardId: t.ids.gadget, effectId: "gadget:response:1" }, t.ctx));
    expect(used.state.cards[t.ids.gadget]?.exhausted).toBe(true);
    expect(used.state.stack).toEqual([]);
  });

  it("refuse an effect that was not offered", () => {
    const { state, ctx, ids } = open([response("gadget:response:1")]);
    const result = reduce(state, { type: "Trigger", cardId: ids.gadget, effectId: "gadget:action:1" }, ctx);
    expect(result.ok).toBe(false);
  });
});

// Rules: mec109.burden-deck, rr.burdens, rr.travel, rr.reveal, rr.surge, rr.cancel, rr.action, rr.response, rr.campaign-cards,
// rr.step-3-3 (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents, legalTargets } from "../../../rules/engine/legal.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { withMode, type ScenarioState } from "../../../rules/core/state.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { CAMPAIGN_CARD, FORD_OF_BRUINEN, fordTable, LAST_BRIDGE, loadFordWorld, type FordLayout, type FordWorld } from "../../../../test/scenarios/flight-to-the-ford/scene.ts";
import { codesOf, first, RING, reveal, send, start } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: FordWorld;

beforeAll(async () => {
  world = await loadFordWorld();
});

function make(layout: FordLayout = {}) {
  return fordTable(world, layout);
}

// Passes windows (and chooses the first enemy to attack) until `stop` holds.
function until(state: ScenarioState, ctx: ReduceContext, stop: (state: ScenarioState) => boolean, guard = 60): ScenarioState {
  let current = state;
  for (let step = 0; step < guard && !stop(current) && !current.lost; step += 1) {
    const window = current.window;
    const legal = legalIntents(current, ctx);
    const pass = legal.find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage" || intent.type === "DeclineTravel");
    if (window?.kind === "chooseEnemy" && window.options[0]) current = send(start(current), { type: "ChooseEnemy", enemyId: window.options[0] }, ctx).state;
    else if (pass) current = send(start(current), pass as Parameters<typeof send>[1], ctx).state;
    else return current;
  }
  return current;
}

// The Travel phase's window, with the burden deck as laid out.
function travelWindow(layout: FordLayout) {
  const made = make(layout);
  const state: ScenarioState = { ...withMode(made.state, "travel"), phase: "Travel", boundaryPhase: "Travel", window: { kind: "travel" } };
  return { ...made, state };
}

describe("the burden deck (mec109.burden-deck)", () => {
  it("The Last Bridge's Travel reveals its top card as if from the encounter deck, and the burden goes to the encounter discard pile (141058:A:3)", () => {
    const { state, ctx } = travelWindow({ staging: [LAST_BRIDGE], burden: ["141083", "141084"], deck: ["f0"] });
    const bridge = first(state, LAST_BRIDGE);
    expect(legalTargets(state, { type: "Travel" }, ctx)).toEqual([bridge]);
    const run = send(start(state), { type: "Travel", locationId: bridge }, ctx);
    // Panicked (141083): the first player raises threat by 3 and passes the token.
    expect(run.state.seats[0].threat).toBe(11);
    expect(run.state.activeLocation).toBe(bridge);
    expect(codesOf(run.state, run.state.burdenDeck ?? [])).toEqual(["141084"]);
    expect(codesOf(run.state, run.state.encounterDiscard)).toEqual(["141083"]);
    expect(causeProblems(run.steps)).toEqual([]);
    // Every burden has Surge: the card after it is revealed from the encounter deck.
    expect(run.steps.filter((step) => step.kind === "reveal")).toMatchObject([{ seat: 0 }, { seat: 0 }]);
    expect(codesOf(run.state, run.state.staging)).toEqual(["f0"]);
  });

  it("cannot be paid when the burden deck is empty: the players cannot travel to The Last Bridge (rr.travel)", () => {
    const { state, ctx } = travelWindow({ staging: [LAST_BRIDGE], burden: [] });
    expect(legalTargets(state, { type: "Travel" }, ctx)).toEqual([]);
    expect(reduce(state, { type: "Travel", locationId: first(state, LAST_BRIDGE) }, ctx).ok).toBe(false);
  });

  it("a burden with Surge reveals one more card, from the encounter deck (Weight of the Ring, 141080)", () => {
    const { state, ctx, frodo } = travelWindow({ staging: [LAST_BRIDGE], burden: ["141080"], deck: ["f0", "f0"] });
    const run = send(start(state), { type: "Travel", locationId: first(state, LAST_BRIDGE) }, ctx);
    const weight = first(run.state, "141080");
    expect(run.state.cards[weight]).toMatchObject({ zone: "attached", host: frodo });
    expect(codesOf(run.state, run.state.staging)).toEqual(["f0"]);
    expect(run.state.encounterDeck).toHaveLength(1);
    expect(run.state.burdenDeck).toEqual([]);
  });

  it("The Ford of Bruinen's Travel reveals the top card of the encounter deck (141059:A:3)", () => {
    const { state, ctx } = travelWindow({ staging: [FORD_OF_BRUINEN], deck: ["f0", "f3"], stage: "141029" });
    const run = send(start(state), { type: "Travel", locationId: first(state, FORD_OF_BRUINEN) }, ctx);
    expect(codesOf(run.state, run.state.staging)).toEqual(["f0"]);
    expect(run.state.encounterDeck).toHaveLength(1);
    expect(run.state.activeLocation).toBe(first(run.state, FORD_OF_BRUINEN));
  });
});

describe("Flight to the Ford's Response (141056:A:2)", () => {
  // The combat phase of a round with an enemy engaged with the first seat: the Response is offered when it attacks.
  function attacked(layout: FordLayout) {
    const made = make({ phase: "Encounter", engaged: [{ code: "grunt", seat: 0 }], deck: ["f0", "f0"], ...layout });
    const state = until(send(start(made.state), { type: "DeclineEngage" }, made.ctx).state, made.ctx, (current) => current.window?.kind === "response" || current.window?.kind === "defense");
    return { ...made, state, grunt: first(made.state, "grunt") };
  }

  it("is offered to the player when an enemy attacks: the top burden is shuffled into the encounter deck and the attack is canceled", () => {
    const { state, ctx, frodo, grunt } = attacked({ campaign: true });
    expect(state.window).toEqual({ kind: "response", seat: 0 });
    const card = first(state, CAMPAIGN_CARD);
    expect(legalIntents(state, ctx)).toContainEqual({ type: "Trigger", cardId: card, effectId: "141056:response:1" });
    const burden = state.burdenDeck?.[0] ?? "";
    const deckBefore = state.encounterDeck.length;
    const run = send(start(state), { type: "Trigger", cardId: card, effectId: "141056:response:1" }, ctx);
    expect(run.state.burdenDeck).toHaveLength(4);
    expect(run.state.encounterDeck).toContain(burden);
    expect(run.state.encounterDeck.length).toBe(deckBefore + 1);
    expect(run.state.cards[burden]?.face).toBe("down");
    // The attack is canceled: nobody is asked to defend, nothing is damaged, and the life stays.
    const round = run.state.round;
    let after = run.state;
    for (let guard = 0; guard < 40 && after.round === round; guard += 1) {
      expect(after.window?.kind).not.toBe("defense");
      const pass = legalIntents(after, ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      after = send(start(after), pass as Parameters<typeof send>[1], ctx).state;
    }
    expect(after.cards[frodo]?.damage).toBe(0);
    expect(after.life).toBeGreaterThan(0);
    expect(after.cards[grunt]?.zone).toBe("engaged");
  });

  it("declining it leaves the attack to resolve", () => {
    const { state, ctx } = attacked({ campaign: true });
    const declined = until(send(start(state), { type: "Pass" }, ctx).state, ctx, (current) => current.window?.kind === "defense");
    expect(declined.window?.kind).toBe("defense");
    expect(declined.burdenDeck).toHaveLength(5);
  });

  it("any player may use it: a second seat is offered it after the first passes", () => {
    const made = make({ seats: 2, phase: "Encounter", engaged: [{ code: "grunt", seat: 0 }], deck: ["f0", "f0"], campaign: true });
    let state = until(send(start(made.state), { type: "DeclineEngage" }, made.ctx).state, made.ctx, (current) => current.window?.kind === "response");
    expect(state.window).toEqual({ kind: "response", seat: 0 });
    state = send(start(state), { type: "Pass" }, made.ctx).state;
    expect(state.window).toEqual({ kind: "response", seat: 1 });
    const card = first(state, CAMPAIGN_CARD);
    expect(legalIntents(state, made.ctx)).toContainEqual({ type: "Trigger", cardId: card, effectId: "141056:response:1" });
    const run = send(start(state), { type: "Trigger", cardId: card, effectId: "141056:response:1" }, made.ctx);
    expect(run.state.burdenDeck).toHaveLength(4);
  });

  it("is not offered with no card in the burden deck, or in a game without the campaign card", () => {
    expect(attacked({ campaign: true, burden: [] }).state.window?.kind).toBe("defense");
    expect(attacked({ campaign: false }).state.window?.kind).toBe("defense");
  });

  it("can be used again for the next attack while the burden deck lasts", () => {
    const made = make({ phase: "Encounter", engaged: [{ code: "grunt", seat: 0 }, { code: "grunt", seat: 0 }], deck: ["f0", "f0", "f0"], campaign: true });
    let state = until(send(start(made.state), { type: "DeclineEngage" }, made.ctx).state, made.ctx, (current) => current.window?.kind === "response");
    const card = first(state, CAMPAIGN_CARD);
    state = send(start(state), { type: "Trigger", cardId: card, effectId: "141056:response:1" }, made.ctx).state;
    expect(state.burdenDeck).toHaveLength(4);
    // The next enemy attacks, and its attack is answered too (the first passes are the windows between the attacks).
    state = until(state, made.ctx, (current) => current.window?.kind === "response" || current.window?.kind === "defense");
    expect(state.window).toEqual({ kind: "response", seat: 0 });
    state = send(start(state), { type: "Trigger", cardId: card, effectId: "141056:response:1" }, made.ctx).state;
    expect(state.burdenDeck).toHaveLength(3);
  });
});

describe("The Old Road's Action (141062:A:1)", () => {
  const ACTION = "141062:action:1";

  it("puts the top burden on top of the encounter deck to place 4 progress on The Old Road, in Campaign Mode", () => {
    const { state, ctx } = make({ staging: ["141062"], campaign: true, deck: ["f0"] });
    const road = first(state, "141062");
    expect(legalIntents(state, ctx)).toContainEqual({ type: "Trigger", cardId: road, effectId: ACTION });
    const burden = state.burdenDeck?.[0] ?? "";
    const run = send(start(state), { type: "Trigger", cardId: road, effectId: ACTION }, ctx);
    expect(run.state.encounterDeck[0]).toBe(burden);
    expect(run.state.burdenDeck).toHaveLength(4);
    // Four progress fill its four quest points: it is explored and leaves play.
    expect(run.steps).toContainEqual(expect.objectContaining({ kind: "progress", targetId: road, amount: 4 }));
    expect(run.state.cards[road]?.zone).not.toBe("staging");
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("is not offered outside Campaign Mode, or with an empty burden deck", () => {
    const standalone = make({ staging: ["141062"], campaign: false });
    expect(legalIntents(standalone.state, standalone.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === ACTION)).toBe(false);
    const empty = make({ staging: ["141062"], campaign: true, burden: [] });
    expect(legalIntents(empty.state, empty.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === ACTION)).toBe(false);
  });

  it("may be used by any player in a two-handed game", () => {
    const made = make({ seats: 2, staging: ["141062"], campaign: true });
    const road = first(made.state, "141062");
    const second = { ...made.state, activeSeat: 1 };
    expect(legalIntents(second, made.ctx)).toContainEqual({ type: "Trigger", cardId: road, effectId: ACTION });
  });
});

describe("Weight of the Ring's Forced effect (141080:A:2)", () => {
  const BEGIN = { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as const;

  function beginQuest(layout: FordLayout) {
    const made = make({ weight: true, deck: ["f0", "f0", "f0", "f0"], ...layout });
    const steps: Parameters<typeof settle>[2] = [];
    const state = settle(fireForced({ ...made.state, window: null }, BEGIN, made.ctx, steps), made.ctx, steps);
    return { ...made, state };
  }

  it("offers the first player The One Ring exhausted or an additional card revealed this phase", () => {
    const { state } = beginQuest({});
    expect(state.window).toEqual({ kind: "choose", seat: 0, options: ["exhaust", "reveal"] });
  });

  it("exhausting The One Ring pays it; the staging step reveals one card", () => {
    const { state, ctx } = beginQuest({});
    const paid = send(start(state), { type: "Choose", optionId: "exhaust" }, ctx).state;
    expect(paid.cards[first(paid, RING)]?.exhausted).toBe(true);
    const staged = reveal(paid, ctx);
    expect(codesOf(staged.state, staged.state.staging)).toEqual(["f0"]);
  });

  it("an additional card makes the staging step reveal two cards, one player alone revealing both", () => {
    const { state, ctx } = beginQuest({});
    const more = send(start(state), { type: "Choose", optionId: "reveal" }, ctx).state;
    expect(more.cards[first(more, RING)]?.exhausted).toBe(false);
    const staged = reveal(more, ctx);
    expect(codesOf(staged.state, staged.state.staging)).toEqual(["f0", "f0"]);
  });

  it("with The One Ring exhausted, the additional card is the only choice, taken without asking", () => {
    const { state, ctx } = beginQuest({ ring: "exhausted" });
    expect(state.window?.kind).not.toBe("choose");
    const staged = reveal(state, ctx);
    expect(codesOf(staged.state, staged.state.staging)).toEqual(["f0", "f0"]);
  });

  it("the additional cards of a two-handed game are revealed by the players in turn, from the first", () => {
    const { state, ctx } = beginQuest({ seats: 2 });
    const more = send(start(state), { type: "Choose", optionId: "reveal" }, ctx).state;
    const staged = reveal(more, ctx, 2);
    expect(staged.steps.filter((step) => step.kind === "reveal").map((step) => step.kind === "reveal" && step.seat)).toEqual([0, 1, 0]);
  });
});

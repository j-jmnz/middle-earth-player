// Rules: rr.triggered-ability, rr.cost, rr.resources, rr.resource-match (data/rules/entries.json).
// Whether an Action of a card in play can change the game (`noChangeReason` in src/rules/player/potential.ts), part 3: a gain of resources for a hero that may not gain them from player card
// effects, an X that no number can be, a discount for the next card of the attached hero's sphere with none in hand, and a discard of the top card of an empty encounter deck. Each with one
// table where the Action is refused and the nearest table where it is offered (`seenTrigger` checks that the offer and the refusal of the Trigger agree).
import { describe, expect, it } from "vitest";

import { z } from "zod";

import { instructionSchema, type Effect } from "../../catalog/boundary.ts";
import { reduce } from "../engine/reduce.ts";
import { withThreat, type Modifier } from "../core/state.ts";
import { hostSpheres } from "../families/costs/verbs.ts";
import { allIdle } from "./idle.ts";
import { cards, idOf, seenTrigger as seen, triggerTable, type Shape } from "../../../test/harness/potential-kit.ts";

const flag = (stat: Modifier["stat"], code = "hero"): Shape => (state) => ({ ...state, modifiers: [...state.modifiers, { instanceId: idOf(state, code), sourceId: "x", stat, amount: 1, until: "endOfRound" }] });
const inHand = ["ally", { zone: "hand", seat: 0 }] as const;
const inEncounterDeck = ["place", { zone: "encounterDeck" }] as const;

describe("a gain of resources for a hero that may not gain them from this card", () => {
  const gain = [{ verb: "AddResources", amount: 1, to: "host" }] as const;

  it("is refused for a player card effect on a hero barred from player card effects (Bilbo Baggins, 131001:A:2), and offered otherwise", () => {
    expect(seen(gain)).toBe(true);
    expect(seen(gain, [], flag("noPlayerCardResources"))).toBe(false);
    expect(seen(gain, [], flag("noCardResources"))).toBe(false);
  });

  it("is refused for a chosen hero when every hero it may choose is barred, and offered when one may gain", () => {
    const steps = [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "AddResources", amount: 1, to: "picked" }] as const;
    expect(seen(steps)).toBe(true);
    expect(seen(steps, [], flag("noPlayerCardResources"))).toBe(false);
    expect(seen(steps, [["hero", { zone: "heroes", seat: 0 }]], flag("noPlayerCardResources"))).toBe(true);
  });
});

describe("a gain of resources for the card the answered event names", () => {
  const idleFor = (steps: readonly unknown[], shape: Shape, scope: "subject" | "other"): boolean => {
    const { state, id } = triggerTable([]);
    const hero = idOf(state, "hero");
    const instructions = z.array(instructionSchema).parse(steps);
    return allIdle(shape(state), instructions, id, 0, { effects: [], cards }, { actor: 0, sourceId: id, [scope]: hero }, {});
  };

  it("is idle for the subject hero barred from player card effects, and not for one that may gain (Proud Hunters, 17032:A:2)", () => {
    const steps = [{ verb: "AddResources", amount: 2, to: "subject" }] as const;
    expect(idleFor(steps, flag("noPlayerCardResources"), "subject")).toBe(true);
    expect(idleFor(steps, (state) => state, "subject")).toBe(false);
  });

  it("is idle for the other card's hero barred, though the step has a condition on the card's type (Rune-master, 12110:A:2)", () => {
    const steps = [{ verb: "AddResources", amount: 1, to: "other", when: { kind: "matches", card: "other", pick: { type: "hero", control: "any" } } }] as const;
    expect(idleFor(steps, flag("noPlayerCardResources"), "other")).toBe(true);
    expect(idleFor(steps, (state) => state, "other")).toBe(false);
  });
});

describe("an X that no number can be, and a discount for a card of the attached hero's sphere", () => {
  const arkenstone = [
    { verb: "ChooseX", min: 1, max: [{ threat: "actor", times: -1, plus: 49 }] },
    { verb: "RaiseThreat", amount: { x: true }, who: "actor" },
    { verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally" }, amount: { x: true }, until: "endOfPhase", hostSphere: true },
  ] as const;
  const threat = (value: number): Shape => (state) => withThreat(state, 0, value);

  it("is refused at a threat where X can only be 0, and offered one below", () => {
    expect(seen(arkenstone, [inHand], threat(48))).toBe(true);
    expect(seen(arkenstone, [inHand], threat(49))).toBe(false);
  });

  it("reads a step of X alone as 0 when no X can be chosen, and not a step of X plus 1", () => {
    const choose = { verb: "ChooseX", min: 1, max: [{ threat: "actor", times: -1, plus: 49 }] } as const;
    expect(seen([choose, { verb: "AddResources", amount: { x: true }, to: "host" }], [], threat(49))).toBe(false);
    expect(seen([choose, { verb: "AddResources", amount: { x: true, plus: 1 }, to: "host" }], [], threat(49))).toBe(true);
  });

  it("is refused with no card of the attached hero's sphere in hand, and offered with one", () => {
    expect(seen(arkenstone, [], threat(20))).toBe(false);
    expect(seen(arkenstone, [["att", { zone: "hand", seat: 0 }]], threat(20))).toBe(false);
    expect(seen(arkenstone, [inHand], threat(20))).toBe(true);
  });

  it("reads the hero's gained icons and not an icon it lost: the hero is a sphere of his printed icon and each icon he gained", () => {
    const { state } = triggerTable([]);
    const host = idOf(state, "hero");
    expect(hostSpheres(state, host, { effects: [], cards })).toEqual(["spirit"]);
    expect(hostSpheres(flag("leadershipIcon")(state), host, { effects: [], cards })).toEqual(["spirit", "leadership"]);
    expect(hostSpheres(flag("losesIcons")(state), host, { effects: [], cards })).toEqual([]);
  });

  it("is refused with no event of the attached hero's sphere in hand although the card discards itself, and offered with one (Good Meal, 04010:A:2)", () => {
    const meal = [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "event" }, amount: 2, until: "endOfRound", hostSphere: true }, { verb: "Discard", target: { kind: "self" } }] as const;
    expect(seen(meal)).toBe(false);
    expect(seen(meal, [["ev", { zone: "hand", seat: 0 }]])).toBe(true);
  });

  it("keeps the discount for a card of each sphere the hero has (Good Meal, 04010:A:2)", () => {
    const steps = [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "event" }, amount: 2, until: "endOfRound", hostSphere: true }] as const;
    const { state, id } = triggerTable([["ev", { zone: "hand", seat: 0 }]]);
    const effect: Effect = { id: "gadget:action:1", cardCode: "gadget", lines: ["gadget:A:1"], timing: "action", instructions: z.array(instructionSchema).parse(steps) };
    const result = reduce(flag("tacticsIcon")(state), { type: "Trigger", cardId: id, effectId: effect.id }, { effects: [effect], cards });
    expect(result.ok && result.state.discounts?.[0]?.pick.spheres).toEqual(["spirit", "tactics"]);
  });
});

describe("a discard of the top card of the encounter deck", () => {
  const discard = [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }] as const;

  it("is refused with an empty encounter deck, and offered with a card in it (Sting, 131020:A:3)", () => {
    expect(seen(discard)).toBe(false);
    expect(seen(discard, [inEncounterDeck])).toBe(true);
  });

  it("is refused with an empty deck whatever the phase and the discard pile, since the move refills nothing (rr.running-out-of-cards)", () => {
    const inDiscard = ["place", { zone: "encounterDiscard" }] as const;
    const quest: Shape = (state) => ({ ...state, phase: "Quest" });
    expect(seen(discard, [inDiscard])).toBe(false);
    expect(seen(discard, [inDiscard], quest)).toBe(false);
    expect(seen(discard, [inEncounterDeck, inDiscard], quest)).toBe(true);
  });

  it("is offered with an empty deck and a discard pile while the Nightmare setup card refills the deck at any time (900201:A:3)", () => {
    const inDiscard = ["place", { zone: "encounterDiscard" }] as const;
    const refill: Shape = (state) => ({ ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "x", stat: "encounterRefill", amount: 1, until: "endOfRound" }] });
    expect(seen(discard, [inDiscard], refill)).toBe(true);
  });
});

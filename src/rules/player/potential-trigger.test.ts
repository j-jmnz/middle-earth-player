// Rules: rr.triggered-ability, rr.cost, rr.then, rr.search, rr.move (data/rules/entries.json).
// Whether an Action of a card in play can change the game (`noChangeReason` in src/rules/player/potential.ts): the attachment "gadget" is on the hero, and for each kind of
// effect there is one table where its Action is refused and the nearest table where it is offered. `seenTrigger` checks that the offer in `legalIntents` and the refusal of the
// Trigger agree on every table.
import { describe, expect, it } from "vitest";

import { updateCard } from "../core/state.ts";
import { heroes, idOf, inDeck, seenTrigger as seen, type Shape } from "../../../test/harness/potential-kit.ts";

const hurt: Shape = (state) => updateCard(state, idOf(state, "hero"), { damage: 2 });
const tired = (code: string): Shape => (state) => updateCard(state, idOf(state, code), { exhausted: true });

describe("an Action that changes the card it is on", () => {
  it("a Ready of itself or of its host that are ready", () => {
    expect(seen([{ verb: "Ready", target: "self" }])).toBe(false);
    expect(seen([{ verb: "Ready", target: "self" }], [], tired("gadget"))).toBe(true);
    expect(seen([{ verb: "Ready", target: "host" }])).toBe(false);
    expect(seen([{ verb: "Ready", target: "host" }], [], tired("hero"))).toBe(true);
  });

  it("a Heal of its host with no damage", () => {
    expect(seen([{ verb: "Heal", all: true, target: "host" }])).toBe(false);
    expect(seen([{ verb: "Heal", all: true, target: "host" }], [], hurt)).toBe(true);
  });
});

describe("an Action that starts with a Pick", () => {
  it("is refused when the Pick finds no card, and offered when it finds one", () => {
    const steps = [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true } }, { verb: "DamageCard", amount: 1 }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [["foe", { zone: "staging" }]])).toBe(true);
  });

  it("is refused when a move of resources has no second hero to take them (rr.move), and offered when there is one", () => {
    const steps = [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "Pick", pick: { ...heroes, different: true } }, { verb: "MoveResources", all: true }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [["hero", { zone: "heroes", seat: 0 }]])).toBe(true);
  });

  it("is refused for a search of an empty deck, and offered for one with a card in it, which may find none and still shuffles (rr.search)", () => {
    const steps = [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "ally" } }, { verb: "MovePicked", to: "hand" }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [inDeck])).toBe(true);
  });

  it("is offered when its Pick reads what the effect chose before it (the table cannot settle it)", () => {
    const steps = [{ verb: "Pick", pick: { type: "attachment", control: "any", onPicked: true } }, { verb: "Discard", target: { kind: "picked" } }] as const;
    expect(seen(steps)).toBe(true);
  });

  it("is refused when every step after the Pick is idle, and offered when one is not", () => {
    const steps = [{ verb: "Pick", pick: heroes }, { verb: "Heal", all: true, target: "picked" }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [], hurt)).toBe(true);
  });
});

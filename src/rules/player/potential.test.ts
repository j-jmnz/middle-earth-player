// Rules: rr.triggered-ability, rr.cost, rr.then, rr.search (data/rules/entries.json).
// Whether an Action of an event can change the game (src/rules/player/potential.ts): for each kind of instruction the check reads, one table where the event is refused and the
// nearest table where it is offered. The offer in `legalIntents` and the refusal of the PlayCard agree on every table (`seenEvent`); an ability whose effect the table cannot settle is offered.
import { describe, expect, it } from "vitest";

import { updateCard, withThreat, type ScenarioState } from "../core/state.ts";
import { exhaustAll, foes, heroes, inDeck, seenEvent as seen } from "../../../test/harness/potential-kit.ts";

describe("an Action that can change nothing is not offered (rr.triggered-ability)", () => {
  it("a Ready of each card, or of a chosen card, with every candidate ready", () => {
    for (const steps of [[{ verb: "Each", pick: heroes, instructions: [{ verb: "Ready", target: "picked" }] }], [{ verb: "Pick", pick: heroes }, { verb: "Ready", target: "picked" }]] as const) {
      expect(seen(steps)).toBe(false);
      expect(seen(steps, [], exhaustAll)).toBe(true);
    }
  });

  it("a Heal of every character with no damage on any", () => {
    const steps = [{ verb: "Each", pick: { type: "character", control: "any" }, instructions: [{ verb: "Heal", all: true, target: "picked" }] }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [], (state) => updateCard(state, Object.keys(state.cards)[0] ?? "", { damage: 1 }))).toBe(true);
  });

  it("damage to each enemy of an empty set", () => {
    const steps = [{ verb: "DamageEach", amount: 1, pick: foes }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [["foe", { zone: "staging" }]])).toBe(true);
  });

  it("a lowering of threat at threat 0, and one by an amount of 0", () => {
    expect(seen([{ verb: "LowerThreat", amount: 2, who: "actor" }], [], (state) => withThreat(state, 0, 0))).toBe(false);
    expect(seen([{ verb: "LowerThreat", amount: 2, who: "actor" }], [], (state) => withThreat(state, 0, 5))).toBe(true);
    const byEngaged = [{ verb: "LowerThreat", amount: { count: { type: "enemy", control: "any", engaged: "you" } }, who: "actor" }] as const;
    expect(seen(byEngaged, [], (state) => withThreat(state, 0, 5))).toBe(false);
    expect(seen(byEngaged, [["foe", { zone: "engaged", seat: 0 }]], (state) => withThreat(state, 0, 5))).toBe(true);
  });

  it("a threat set to the value it has", () => {
    expect(seen([{ verb: "SetThreat", value: 40 }], [], (state) => withThreat(state, 0, 40))).toBe(false);
    expect(seen([{ verb: "SetThreat", value: 40 }], [], (state) => withThreat(state, 0, 35))).toBe(true);
  });

  it("a step whose condition on the threat fails, beside a threat set to the value it has", () => {
    const steps = [{ verb: "Draw", amount: 1, when: { kind: "threat", max: 30 } }, { verb: "SetThreat", value: 40 }] as const;
    expect(seen(steps, [inDeck], (state) => withThreat(state, 0, 40))).toBe(false);
    expect(seen(steps, [inDeck], (state) => withThreat(state, 0, 20))).toBe(true);
  });

  it("each player draws with every deck empty, and a discard from an empty deck", () => {
    const draw = [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", amount: 2 }] }] as const;
    expect(seen(draw)).toBe(false);
    expect(seen(draw, [inDeck])).toBe(true);
    expect(seen([{ verb: "DiscardFromDeck", amount: 2 }])).toBe(false);
    expect(seen([{ verb: "DiscardFromDeck", amount: 2 }], [inDeck])).toBe(true);
  });

  it("an engage of every enemy when each is engaged with you already", () => {
    const steps = [{ verb: "Each", pick: foes, instructions: [{ verb: "Engage", target: "picked" }] }] as const;
    expect(seen(steps, [["foe", { zone: "engaged", seat: 0 }]])).toBe(false);
    expect(seen(steps, [["foe", { zone: "engaged", seat: 0 }], ["foe", { zone: "staging" }]])).toBe(true);
  });

  it("a gain of resources for each card of an empty set", () => {
    const steps = [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "AddResources", amount: { count: { type: "enemy", control: "any", engaged: "you" } }, to: "picked" }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [["foe", { zone: "engaged", seat: 0 }]])).toBe(true);
  });

  it("a put-into-play for each card of an empty set", () => {
    const steps = [{ verb: "Repeat", times: { count: { type: "enemy", control: "any", engaged: "you" } }, instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "discard", cardType: "ally", intoPlay: true } }, { verb: "MovePicked", to: "play" }] }] as const;
    expect(seen(steps, [["ally", { zone: "discard", seat: 0 }]])).toBe(false);
    expect(seen(steps, [["ally", { zone: "discard", seat: 0 }], ["foe", { zone: "engaged", seat: 0 }]])).toBe(true);
  });

  it("a stat change of every card of a filter with no card in play", () => {
    const steps = [{ verb: "ModifyStat", stat: "willpower", amount: 2, until: "endOfPhase", holders: { type: "character", control: "any", trait: "Rohan" } }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [["ally", { zone: "play", seat: 0 }]])).toBe(true);
  });

  it("a choice whose options are out of reach or do nothing", () => {
    const steps = [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Choose", who: "actor", options: [
      { id: "hit", requires: { kind: "canPick", pick: foes }, instructions: [{ verb: "Pick", pick: foes }, { verb: "DamageCard", amount: 1 }] },
      { id: "skip", instructions: [] },
    ] }] }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [["foe", { zone: "staging" }]])).toBe(true);
  });

  it("a pick of a card to move from a discard pile with none there", () => {
    const steps = [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "discard", cardType: "attachment", topmost: true } }, { verb: "MovePicked", to: "hand" }] }] as const;
    expect(seen(steps)).toBe(false);
    expect(seen(steps, [["ally", { zone: "discard", seat: 0 }]])).toBe(false);
    expect(seen(steps, [["att", { zone: "discard", seat: 0 }]])).toBe(true);
  });

  it("a play from a discard pile of an event that cannot be paid for", () => {
    const pick = { type: "card", control: "you", from: "discard", cardType: "event", sphere: "spirit" } as const;
    const steps = [{ verb: "PlayFrom", pick }, { verb: "PutOnDeck", position: "bottom" }] as const;
    expect(seen(steps, [["pricey", { zone: "discard", seat: 0 }]])).toBe(false);
    expect(seen(steps, [["pricey", { zone: "discard", seat: 0 }]], (state) => updateCard(state, Object.keys(state.cards)[0] ?? "", { resources: 5 }))).toBe(true);
  });
});

describe("a step that pays for the rest of the effect is idle with it", () => {
  it("a discard from the hand or a raise of threat before an effect that does nothing", () => {
    const heal = [{ verb: "Each", pick: heroes, instructions: [{ verb: "Heal", amount: 1, target: "picked" }] }] as const;
    const hurt = (state: ScenarioState): ScenarioState => updateCard(state, Object.keys(state.cards)[0] ?? "", { damage: 1 });
    expect(seen([{ verb: "DiscardFromHand", amount: 1 }, ...heal])).toBe(false);
    expect(seen([{ verb: "DiscardFromHand", amount: 1 }, ...heal], [], hurt)).toBe(true);
    expect(seen([{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }, { verb: "Draw" }])).toBe(false);
    expect(seen([{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }, { verb: "Draw" }], [inDeck])).toBe(true);
  });

  it("a reduction of the next cost by 0, and damage to each enemy engaged with a chosen player with none", () => {
    const none = { count: { type: "attachment", control: "you", trait: "Pipe" } } as const;
    expect(seen([{ verb: "ReduceNextCost", pick: { type: "card", control: "you" }, amount: none, until: "used" }])).toBe(false);
    const engaged = [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "DamageEach", amount: 2, engagedWith: "picked" }] as const;
    expect(seen(engaged, [["foe", { zone: "staging" }]])).toBe(false);
    expect(seen(engaged, [["foe", { zone: "engaged", seat: 0 }]])).toBe(true);
  });
});

describe("an Action the table cannot settle is offered (rr.search, rr.then)", () => {
  it("an amount read from a choice is read for each candidate, and with a second choice in between it is not settled", () => {
    const amount = { stat: "threat", of: "picked", printed: true } as const;
    const one = [{ verb: "Pick", pick: foes }, { verb: "ModifyStat", stat: "willpower", amount, until: "endOfPhase", target: "picked" }] as const;
    expect(seen(one, [["foe", { zone: "staging" }]])).toBe(true);
    const second = [{ verb: "Pick", pick: foes }, { verb: "Pick", pick: heroes }, { verb: "ModifyStat", stat: "willpower", amount, until: "endOfPhase", target: "picked" }] as const;
    expect(seen(second, [["foe", { zone: "staging" }]])).toBe(true);
  });

  it("a search of a deck that holds cards, which may find none and still shuffles, and one of an empty deck", () => {
    const search = [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "ally" } }, { verb: "MovePicked", to: "hand" }, { verb: "ShuffleDeck" }] as const;
    expect(seen(search)).toBe(false);
    expect(seen(search, [["att", { zone: "deck", seat: 0 }]])).toBe(true);
    expect(seen(search.slice(0, 2), [["att", { zone: "deck", seat: 0 }]])).toBe(true);
  });

  it("an effect whose condition reads the running effect", () => {
    expect(seen([{ verb: "Draw", amount: 1, when: { kind: "matches", card: "picked" } }, { verb: "SetThreat", value: 0 }], [], (state) => withThreat(state, 0, 0))).toBe(true);
  });
});

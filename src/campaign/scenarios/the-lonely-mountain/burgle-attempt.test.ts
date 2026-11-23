// Rules: hob.burgle, hob.burgle-example, rr.first-player, rr.running-out-of-cards (data/rules/entries.json); docs/scenarios/the-hobbit.md (The Lonely Mountain).
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { bilbo, make, resolveAndDrive, type Plan } from "../../../../test/scenarios/the-lonely-mountain/moments.ts";
import { codesIn, send } from "../../../../test/harness/scene-kit.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

// The steps of a burgle attempt (hob.burgle, hob.burgle-example) played from A Bare Patch's Response, with one player and with two: step 1 discards and reveals nothing, step 2 reveals the top card of the first player's deck and leaves it there, the players act
// before step 3, an attempt fails with an empty deck, with no burgle card to find or with too few matching cards, and what "match" means for a cost. Hands: 01016 Snowbourn Scout (leadership ally, 1), 01048 Hasty Stroke (spirit event, 1), 01050 A Test of Will (spirit event, 1),
// 01067 Gandalf's Search (lore event, cost X), 08010 The White Council (neutral event, cost X).

type Spec = { deck: readonly string[]; deckOf: readonly string[]; hand: readonly string[]; seats?: 1 | 2; plan?: Plan; stopAt?: readonly string[] };

const make1 = (effects: readonly Effect[], spec: Spec) => make({ seats: spec.seats ?? 1, staging: ["132041", "132039"], deck: spec.deck, deckOf: spec.deckOf, hand: spec.hand, heroes: [bilbo(0)] }, effects);
const handOf = (state: ScenarioState, seat: number): string[] => state.seats[seat]?.hand.map((id) => state.cards[id]?.code ?? "").sort() ?? [];
const attach = (state: ScenarioState): boolean => Object.values(state.cards).find((card) => card.code === "132039")?.zone === "attached";

function play(effects: readonly Effect[], spec: Spec) {
  const made = make1(effects, spec);
  const run = resolveAndDrive(made, "132039", "response", spec.plan ?? { answers: ["discard"] }, spec.stopAt);
  return { made, run, state: run.state };
}

const PLAYERS = [1, 2] as const;
// The same moment with a hand that matches: the attempt succeeds, so a check of a failure also holds only while the records of its line make the attempt.
const control = (effects: readonly Effect[], effect: string, deck: string, hand: readonly string[]): void => {
  expect(attach(play(effects, { deck: [effect, "f0"], deckOf: [deck, deck, deck], hand }).state)).toBe(true);
};

describe("132039:A:2 burgle step 1: encounter cards are discarded from the top and never revealed", () => {
  for (const seats of PLAYERS) {
    lineSpec("132039:A:2", `with ${seats} player(s) a card without a burgle effect and the one with it go to the discard pile; no When Revealed resolves, no surge reveals a card and the next card stays on the deck`, (effects) => {
      const done = play(effects, { seats, deck: ["132051", "132042", "f0", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"] });
      expect(codesIn(done.state, "encounterDiscard").sort()).toEqual(["132042", "132051"]);
      // Dragon-Spell's When Revealed did not attach it to a hero, and the surge of Croaking Crows revealed nothing.
      expect(codesIn(done.state, "attached")).toEqual(["132039"]);
      expect(codesIn(done.state, "encounterDeck")).toEqual(["f0", "f0"]);
      expect(codesIn(done.state, "staging").sort()).toEqual(["132041"]);
      expect(handOf(done.state, 0)).toEqual([]);
      // Only the first player's hand is touched.
      expect(handOf(done.state, 1)).toEqual(seats === 2 ? ["01016"] : []);
    });
  }
});

describe("132039:A:2 burgle step 2: the first player's top card is revealed and stays on his deck", () => {
  const spec = { deck: ["132042", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01016"] } as const;
  lineSpec("132039:A:2", "a failed attempt leaves every card of the deck on it and the hand as it was", (effects) => {
    control(effects, "132042", "01016", ["01016"]);
    const done = play(effects, { ...spec, plan: { answers: ["decline"] } });
    expect(done.state.seats[0]?.deck.length).toBe(3);
    expect(handOf(done.state, 0)).toEqual(["01016"]);
    expect(attach(done.state)).toBe(false);
  });
  lineSpec("132039:A:2", "a successful attempt discards from the hand only: the deck keeps its three cards", (effects) => {
    const done = play(effects, spec);
    expect(attach(done.state)).toBe(true);
    expect(done.state.seats[0]?.deck.length).toBe(3);
    expect(done.state.seats[0]?.discard.length).toBe(1);
  });
  lineSpec("132039:A:2", "the players act after step 2 and before step 3: the effect card is discarded, the hand still holds its cards and no discard was asked yet", (effects) => {
    const done = play(effects, { ...spec, stopAt: ["frameAction"] });
    expect(done.state.window?.kind).toBe("frameAction");
    expect(codesIn(done.state, "encounterDiscard")).toEqual(["132042"]);
    expect(handOf(done.state, 0)).toEqual(["01016"]);
    expect(attach(done.state)).toBe(false);
    const burgle = done.state.stack.find((entry) => entry.data.kind === "burgle");
    expect(burgle?.data.kind === "burgle" ? done.state.cards[burgle.data.revealedId ?? ""]?.zone : null).toBe("deck");
    // Passing in the window opens step 3: the first player is asked whether to discard.
    const passed = send(done.run, { type: "Pass" }, done.made.ctx);
    expect(passed.state.window?.kind).toBe("choose");
  });
});

describe("132039:A:2 a burgle attempt fails by itself", () => {
  for (const seats of PLAYERS) {
    lineSpec("132039:A:2", `with ${seats} player(s) and no card left in the first player's deck the attempt fails and no discard is asked`, (effects) => {
      const done = play(effects, { seats, deck: ["132042", "f0"], deckOf: [], hand: ["01016"], plan: {} });
      expect(codesIn(done.state, "encounterDiscard")).toEqual(["132042"]);
      expect(attach(done.state)).toBe(false);
      expect(handOf(done.state, 0)).toEqual(["01016"]);
      expect(done.state.window?.kind).not.toBe("choose");
    });
    lineSpec("132039:A:2", `with ${seats} player(s) and no card with a burgle effect in the encounter deck the attempt fails and no encounter card is discarded`, (effects) => {
      control(effects, "132042", "01016", ["01016"]);
      const done = play(effects, { seats, deck: ["f0", "f0"], deckOf: ["01016", "01016"], hand: ["01016"], plan: {} });
      expect(codesIn(done.state, "encounterDiscard")).toEqual([]);
      expect(codesIn(done.state, "encounterDeck")).toEqual(["f0", "f0"]);
      expect(attach(done.state)).toBe(false);
      expect(handOf(done.state, 0)).toEqual(["01016"]);
    });
  }
});

describe("132046:A:2 burgle by cost: the printed cost, whatever the sphere and the type", () => {
  lineSpec("132046:A:2", "two cards of cost 1 match a revealed cost 1 card although their sphere and their type differ", (effects) => {
    const done = play(effects, { deck: ["132046", "f0"], deckOf: ["01016", "01016", "01016"], hand: ["01048", "01050", "04108"] });
    expect(attach(done.state)).toBe(true);
    expect(handOf(done.state, 0)).toEqual(["04108"]);
  });
  lineSpec("132046:A:2", "an X cost matches nothing: two X cards do not match a revealed X card", (effects) => {
    control(effects, "132046", "01016", ["01016", "01048"]);
    const done = play(effects, { deck: ["132046", "f0"], deckOf: ["01067", "01067", "01067"], hand: ["01067", "08010", "01067"], plan: {} });
    expect(attach(done.state)).toBe(false);
    expect(handOf(done.state, 0)).toEqual(["01067", "01067", "08010"]);
  });
  lineSpec("132046:A:2", "X cards in the hand do not match a revealed card with a number cost", (effects) => {
    control(effects, "132046", "01016", ["01016", "01048"]);
    const done = play(effects, { deck: ["132046", "f0"], deckOf: ["01048", "01048", "01048"], hand: ["01067", "08010"], plan: {} });
    expect(attach(done.state)).toBe(false);
    expect(handOf(done.state, 0)).toEqual(["01067", "08010"]);
  });
});

describe("132047:A:2 burgle by sphere: a neutral card matches a neutral revealed card", () => {
  lineSpec("132047:A:2", "two neutral cards match a revealed neutral card", (effects) => {
    const done = play(effects, { deck: ["132047", "f0"], deckOf: ["08010", "08010", "08010"], hand: ["08010", "08010", "01016"] });
    expect(attach(done.state)).toBe(true);
    expect(handOf(done.state, 0)).toEqual(["01016"]);
  });
});

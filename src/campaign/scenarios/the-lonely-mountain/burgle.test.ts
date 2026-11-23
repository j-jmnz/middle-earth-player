// Rules: hob.burgle, hob.burgle-example, rr.first-player, rr.response, rr.forced, rr.action, rr.cost, rr.resources (data/rules/entries.json); docs/scenarios/the-hobbit/the-lonely-mountain.md (The Lonely Mountain).
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { lineSpec } from "../../../../test/harness/line-spec.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { bilbo, drive, make, resolveAndDrive, type Plan } from "../../../../test/scenarios/the-lonely-mountain/moments.ts";
import { codesIn, idOf, legalIntents, zoneOf } from "../../../../test/harness/scene-kit.ts";

// The burgle effects of The Lonely Mountain's encounter cards and A Bare Patch's Response, played through the attempt: the first player discards the cards that match, or the attempt fails. Each moment is an attempt that A Bare Patch makes (132039:A:2), the
// encounter deck holding the card with the burgle effect on top. The player deck holds the cards of one code, so the shuffle cannot change the revealed card. Written from the printed lines, with the hand and the revealed card named as cards of the game:
// 01016 Snowbourn Scout (leadership ally, cost 1), 01028 Veteran Axehand (tactics ally, 2), 02102 Silvan Tracker (lore ally, 3), 01048 Hasty Stroke (spirit event, 1), 04108 Daeron's Runes (lore event, 0), 01050 A Test of Will (spirit event, 1).

type Attempt = { effect: string; deck: string; hand: readonly string[]; plan?: Plan; resources?: number };

function attempt(effects: readonly Effect[], spec: Attempt) {
  const made = make({ staging: ["132041", "132039"], deck: [spec.effect, "f0", "f0"], deckOf: [spec.deck, spec.deck, spec.deck], hand: spec.hand, heroes: [bilbo(spec.resources ?? 0)] }, effects);
  const run = resolveAndDrive(made, "132039", "response", spec.plan ?? { answers: ["discard"] });
  const state = run.state;
  const patch = Object.values(state.cards).find((card) => card.code === "132039");
  return { made, state, attached: patch?.zone === "attached", effectDiscarded: codesIn(state, "encounterDiscard").includes(spec.effect), hand: state.seats[0]?.hand.map((id) => state.cards[id]?.code ?? "").sort() ?? [] };
}

const wins = (effects: readonly Effect[], spec: Attempt) => {
  const done = attempt(effects, spec);
  expect(done.effectDiscarded).toBe(true);
  expect(done.attached).toBe(true);
  return done;
};
const fails = (effects: readonly Effect[], spec: Attempt) => {
  const done = attempt(effects, spec);
  expect(done.effectDiscarded).toBe(true);
  expect(done.attached).toBe(false);
  return done;
};

describe("132042:A:3 Croaking Crows burgle: 1 card of the revealed card's sphere and type", () => {
  lineSpec("132042:A:3", "a hand card of the revealed card's sphere and type is discarded and the attempt succeeds", (effects) => {
    const done = wins(effects, { effect: "132042", deck: "01016", hand: ["01016", "01048"] });
    expect(done.hand).toEqual(["01048"]);
  });
  lineSpec("132042:A:3", "a card of the type but not the sphere does not match, so the attempt fails and the hand stays", (effects) => {
    const done = fails(effects, { effect: "132042", deck: "01016", hand: ["01028", "01048"], plan: { answers: [] } });
    expect(done.hand).toEqual(["01028", "01048"]);
  });
  lineSpec("132042:A:3", "the first player may decline to discard: the attempt fails and the hand stays", (effects) => {
    const done = fails(effects, { effect: "132042", deck: "01016", hand: ["01016"], plan: { answers: ["decline"] } });
    expect(done.hand).toEqual(["01016"]);
  });
});

describe("132044:A:2 Great Hall burgle: 3 cards of the revealed card's type", () => {
  lineSpec("132044:A:2", "three allies match a revealed ally and are discarded", (effects) => {
    const done = wins(effects, { effect: "132044", deck: "01016", hand: ["01016", "01028", "02102", "01048"] });
    expect(done.hand).toEqual(["01048"]);
  });
  lineSpec("132044:A:2", "two matching cards are too few: the attempt fails and nothing is discarded", (effects) => {
    const done = fails(effects, { effect: "132044", deck: "01016", hand: ["01016", "01028", "01048"], plan: { answers: [] } });
    expect(done.hand).toEqual(["01016", "01028", "01048"]);
  });
});

describe("132046:A:2 Desolation of Smaug burgle: 2 cards of the revealed card's cost", () => {
  lineSpec("132046:A:2", "two cards of the revealed card's cost are discarded", (effects) => {
    const done = wins(effects, { effect: "132046", deck: "c2", hand: ["c2", "c2", "c1"] });
    expect(done.hand).toEqual(["c1"]);
  });
  lineSpec("132046:A:2", "one card of that cost is too few: the attempt fails", (effects) => {
    const done = fails(effects, { effect: "132046", deck: "c2", hand: ["c2", "c1", "c3"], plan: { answers: [] } });
    expect(done.hand).toEqual(["c1", "c2", "c3"]);
  });
});

describe("132047:A:2 Western Slopes burgle: 2 cards of the revealed card's sphere", () => {
  lineSpec("132047:A:2", "two cards of the revealed card's sphere are discarded, whatever their type", (effects) => {
    const done = wins(effects, { effect: "132047", deck: "01048", hand: ["01048", "01050", "01016"] });
    expect(done.hand).toEqual(["01016"]);
  });
  lineSpec("132047:A:2", "one card of that sphere is too few: the attempt fails", (effects) => {
    fails(effects, { effect: "132047", deck: "01048", hand: ["01048", "01016", "01028"], plan: { answers: [] } });
  });
});

describe("132048:A:3 Pretending to Sleep burgle: 2 cards of the revealed card's type", () => {
  lineSpec("132048:A:3", "two events match a revealed event and are discarded", (effects) => {
    const done = wins(effects, { effect: "132048", deck: "01048", hand: ["04108", "01050", "01016"] });
    expect(done.hand).toEqual(["01016"]);
  });
  lineSpec("132048:A:3", "one event is too few: the attempt fails", (effects) => {
    fails(effects, { effect: "132048", deck: "01048", hand: ["04108", "01016", "01028"], plan: { answers: [] } });
  });
});

describe("132049:A:2 Known to an Ounce burgle: 1 card of the revealed card's sphere and cost", () => {
  lineSpec("132049:A:2", "a card of that sphere and that cost is discarded", (effects) => {
    const done = wins(effects, { effect: "132049", deck: "01048", hand: ["01050", "04108"] });
    expect(done.hand).toEqual(["04108"]);
  });
  lineSpec("132049:A:2", "a card of the cost but not the sphere does not match", (effects) => {
    fails(effects, { effect: "132049", deck: "01048", hand: ["01016", "04108"], plan: { answers: [] } });
  });
});

describe("132050:A:2 Belching Fire burgle: 1 card of the revealed card's type and cost", () => {
  lineSpec("132050:A:2", "a card of that type and that cost is discarded", (effects) => {
    const done = wins(effects, { effect: "132050", deck: "01048", hand: ["event", "04108"] });
    expect(done.hand).toEqual(["04108"]);
  });
  lineSpec("132050:A:2", "a card of the cost but not the type does not match", (effects) => {
    fails(effects, { effect: "132050", deck: "01048", hand: ["01016", "04108"], plan: { answers: [] } });
  });
});

describe("132039:A:2 A Bare Patch Response: the first player makes a burgle attempt and, if it succeeds, the patch attaches to Smaug the Magnificent", () => {
  lineSpec("132039:A:2", "a successful attempt attaches A Bare Patch to Smaug the Magnificent", (effects) => {
    const done = wins(effects, { effect: "132042", deck: "01016", hand: ["01016"] });
    const patch = Object.values(done.state.cards).find((card) => card.code === "132039");
    expect(patch?.host).toBe(idOf(done.state, "132041"));
  });
  lineSpec("132039:A:2", "an attempt is made only while Smaug the Magnificent is in play: with him out of play the patch stays in the staging area and no card is discarded", (effects) => {
    const absent = make({ staging: ["132039"], deck: ["132042", "f0"], deckOf: ["01016", "01016"], hand: ["01016"], heroes: [bilbo(0)] }, effects);
    const idle = resolveAndDrive(absent, "132039", "response", { answers: ["discard"] });
    expect(idle.state.encounterDiscard).toEqual([]);
    expect(zoneOf(idle.state, "132039")).toBe("staging");
    expect(attempt(effects, { effect: "132042", deck: "01016", hand: ["01016"] }).effectDiscarded).toBe(true);
  });
});

describe("132043:A:2 The Lonely Mountain Action: while a burgle attempt is made, 2 Baggins resources take the revealed card into hand and reveal the next card", () => {
  const begin = (effects: readonly Effect[], resources: number, deckOf: readonly string[]) => {
    const made = make({ staging: ["132041", "132039", "132043"], deck: ["132042", "f0", "f0"], deckOf, hand: ["01016"], heroes: [bilbo(resources)] }, effects);
    return { made, run: resolveAndDrive(made, "132039", "response", {}, ["frameAction"]) };
  };
  const revealed = (state: ScenarioState): string | null => {
    const frame = state.stack.find((entry) => entry.data.kind === "burgle");
    return frame?.data.kind === "burgle" ? frame.data.revealedId : null;
  };
  const bilboPool = (state: ScenarioState): number => state.cards[idOf(state, "132001")]?.resources ?? -1;

  lineSpec("132043:A:2", "in the attempt's action window 2 Baggins resources put the revealed card into the hand and reveal the next card", (effects) => {
    const { made, run } = begin(effects, 3, ["01016", "01016", "01016"]);
    const before = revealed(run.state);
    expect(before).toBeTruthy();
    const taken = drive(run, made, { use: [{ code: "132043" }] }, ["choose"]);
    expect(taken.state.cards[before ?? ""]?.zone).toBe("hand");
    expect(taken.state.seats[0]?.hand).toContain(before);
    expect(revealed(taken.state)).toBe(taken.state.seats[0]?.deck[0]);
    expect(revealed(taken.state)).not.toBe(before);
    expect(bilboPool(taken.state)).toBe(1);
  });
  lineSpec("132043:A:2", "with fewer than 2 Baggins resources the Action is not offered", (effects) => {
    const poor = begin(effects, 1, ["01016", "01016", "01016"]);
    const rich = begin(effects, 2, ["01016", "01016", "01016"]);
    const offered = (run: ReturnType<typeof begin>) => legalIntents(run.run.state, run.made.ctx).some((intent) => intent.type === "Trigger" && run.run.state.cards[intent.cardId]?.code === "132043");
    expect([offered(poor), offered(rich)]).toEqual([false, true]);
  });
  lineSpec("132043:A:2", "it takes the last card of the deck and the attempt fails: no card is left to reveal", (effects) => {
    const { made, run } = begin(effects, 2, ["01016"]);
    const taken = drive(run, made, { use: [{ code: "132043" }] });
    expect(taken.state.seats[0]?.hand.length).toBe(2);
    expect(zoneOf(taken.state, "132039")).toBe("staging");
    expect(codesIn(taken.state, "encounterDiscard")).toContain("132042");
  });
});

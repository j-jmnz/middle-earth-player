import { describe, expect, it } from "vitest";

import { cardMap, expectOk, fixtureDefinition, hero } from "./test-fixture.ts";
import { definePrinted } from "./printed.ts";
import { reduce } from "../engine/reduce.ts";
import { blankScenario, updateCard, withThreat } from "./state.ts";
import { moveCard, spawn } from "./zones.ts";

describe("zone identity", () => {
  it("keeps the hand array when threat changes", () => {
    const doomed = definePrinted({
      code: "doomed",
      name: "Doomed",
      type: "treachery",
      threat: 0,
      keywords: { doomed: 2 },
    });
    const cards = cardMap([hero("aragorn", "leadership", 10, 0), doomed, definePrinted({ code: "card", name: "Card", type: "event", cost: 0 })]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    const hand = spawn(state, "card", { zone: "hand", seat: 0 });
    state = withThreat(hand.state, 0, 10);
    state = spawn(state, "doomed", { zone: "encounterDeck" }).state;
    state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 };
    const handBefore = state.seats[0].hand;
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(resolved.state.seats[0].threat).toBe(12);
    expect(resolved.state.seats[0].hand).toBe(handBefore);
    expect(resolved.state.secondActiveLocation).toBeNull();
  });
});

describe("entry order", () => {
  it("stamps a card when it enters play, once, and not when it moves between play zones", () => {
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const deckCard = spawn(state, "a", { zone: "encounterDeck" });
    const other = spawn(deckCard.state, "b", { zone: "encounterDeck" });
    state = other.state;
    expect(state.cards[deckCard.id]?.enteredPlay).toBe(0);
    state = moveCard(state, other.id, { zone: "staging" });
    state = moveCard(state, deckCard.id, { zone: "staging" });
    expect(state.cards[other.id]?.enteredPlay).toBe(1);
    expect(state.cards[deckCard.id]?.enteredPlay).toBe(2);
    state = moveCard(state, other.id, { zone: "engaged", seat: 0 });
    expect(state.cards[other.id]?.enteredPlay).toBe(1);
    state = moveCard(state, other.id, { zone: "encounterDiscard" });
    state = moveCard(state, other.id, { zone: "staging" });
    expect(state.cards[other.id]?.enteredPlay).toBe(3);
  });
});

describe("a shadow card leaving its enemy", () => {
  function dealt() {
    const state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const enemy = spawn(state, "orc", { zone: "engaged", seat: 0 });
    const first = spawn(enemy.state, "shadow-a", { zone: "encounterDeck" });
    const second = spawn(first.state, "shadow-b", { zone: "encounterDeck" });
    let next = moveCard(second.state, first.id, { zone: "shadow", enemyId: enemy.id });
    next = moveCard(next, second.id, { zone: "shadow", enemyId: enemy.id });
    return { state: next, enemy: enemy.id, first: first.id, second: second.id };
  }

  it("is no longer attached to the enemy it was dealt to, whichever shadow card it was (rr.shadow-effects)", () => {
    const { state, enemy, first, second } = dealt();
    expect([state.cards[first]?.host, state.cards[second]?.host]).toEqual([enemy, enemy]);
    const gone = moveCard(moveCard(state, first, { zone: "encounterDiscard" }), second, { zone: "encounterDiscard" });
    expect(gone.cards[enemy]?.shadowId).toBeNull();
    expect(gone.cards[enemy]?.extraShadowIds).toBeUndefined();
    expect([gone.cards[first]?.host, gone.cards[second]?.host]).toEqual([null, null]);
  });
});

// A card enters play ready and not committed (rr.ready): what it was when it left play does not come back with it.
describe("a card that enters play again", () => {
  it("is not committed to the quest, though it left play committed", () => {
    const start = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const spawned = spawn(start, "ally", { zone: "play", seat: 0 });
    const committed = updateCard(spawned.state, spawned.id, { committed: true, exhausted: true });
    const back = moveCard(moveCard(committed, spawned.id, { zone: "discard", seat: 0 }), spawned.id, { zone: "play", seat: 0 });
    expect(back.cards[spawned.id]).toMatchObject({ zone: "play", committed: false, exhausted: false });
  });
});

describe("a card that goes back to a hand or a deck", () => {
  // rr.in-play-and-out-of-play: it has left play, so it is not exhausted or committed and holds no tokens (Sneak Attack returns an exhausted Halfling Bounder to the hand).
  it("is ready, uncommitted and clear of tokens in the hand and the deck", () => {
    const start = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    const spawned = spawn(start, "ally", { zone: "play", seat: 0 });
    const worn = updateCard(spawned.state, spawned.id, { committed: true, exhausted: true, damage: 2, resources: 1, progress: 1 });
    for (const zone of ["hand", "deck"] as const) {
      const away = moveCard(worn, spawned.id, { zone, seat: 0 });
      expect(away.cards[spawned.id]).toMatchObject({ zone, committed: false, exhausted: false, damage: 0, resources: 0, progress: 0 });
    }
  });
});

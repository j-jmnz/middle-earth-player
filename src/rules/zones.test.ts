import { describe, expect, it } from "vitest";

import { cardMap, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { definePrinted } from "./printed.ts";
import { reduce } from "./reduce.ts";
import { blankScenario, withThreat } from "./state.ts";
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

import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/deck.ts";

import { expectOk } from "../../core/test-fixture.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import type { ScenarioState } from "../../core/state.ts";
import { card, put, table } from "../costs/fixture.ts";

// Rules: rr.response, rr.mulligan, rr.play-and-put-into-play, rr.cost, rr.limits, rr.search (data/rules/entries.json).
// The deck family's Responses and Actions that act on how a card is played or drawn: the opening hand, a cost lowered by
// discarding from the deck, a limit once a phase, and a choice of different options.

const galdor = card("11002", "hero", "lore", null, { threat: 10 });
const guard = card("16004", "ally", "neutral", 3);
const treePeople = card("08009", "event", "neutral", 0);
const council = card("08010", "event", "neutral", 0);
const silvan = card("silvan", "ally", "neutral", 1, { traits: ["Silvan"] });
const filler = card("filler", "ally", "neutral", 1);
const CARDS = [galdor, guard, treePeople, council, silvan, filler];

function settle(state: ScenarioState, ctx: Parameters<typeof reduce>[2], pick: (options: readonly string[]) => string = (options) => options[0] ?? ""): ScenarioState {
  let next = state;
  for (let guard = 0; guard < 30; guard += 1) {
    if (next.window?.kind === "choose") next = expectOk(reduce(next, { type: "Choose", optionId: pick(next.window.options) }, ctx)).state;
    else if (next.window?.kind === "look") next = expectOk(reduce(next, { type: "Pass" }, ctx)).state;
    else break;
  }
  return next;
}

describe("Erebor Guard: discarding from the deck to pay less", () => {
  it("is played for 2 less by discarding the top 2 cards of the deck", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const ally = put(state, "16004", "hand");
    const deck = put(put(put(ally.state, "filler", "deck").state, "filler", "deck").state, "filler", "deck");
    const played = expectOk(reduce(deck.state, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 1 }] }, ctx)).state;
    expect(played.cards[ally.id]?.zone).toBe("play");
    expect(played.seats[0].discard.length).toBe(2);
    expect(played.seats[0].deck.length).toBe(1);
  });

  it("cannot be played for less when the deck holds fewer than 2 cards", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const ally = put(state, "16004", "hand");
    const deck = put(ally.state, "filler", "deck");
    const result = reduce(deck.state, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 1 }] }, ctx);
    expect(result.ok).toBe(false);
  });
});

describe("Galdor of the Havens: the opening hand", () => {
  it("offers the Response in the mulligan window and draws as many cards as were discarded from the hand", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["11002"]]);
    const hand = put(put(put(state, "filler", "hand").state, "filler", "hand").state, "silvan", "hand");
    const deck = put(put(hand.state, "silvan", "deck").state, "silvan", "deck");
    const mulligan: ScenarioState = { ...deck.state, mode: "mulligan", phase: "Setup", boundaryPhase: "Setup", window: { kind: "mulligan" } };
    const offered = legalIntents(mulligan, ctx).filter((intent) => intent.type === "Trigger");
    expect(offered.length).toBe(1);
    const trigger = offered[0];
    if (trigger?.type !== "Trigger") throw new Error("no trigger");
    let next = expectOk(reduce(mulligan, trigger, ctx)).state;
    next = settle(next, ctx, (options) => (options.includes(hand.id) ? hand.id : (options[0] ?? "")));
    // Every card was discarded; the deck held two, so two are drawn.
    expect([next.seats[0].hand.length, next.seats[0].deck.length, next.seats[0].discard.length]).toEqual([2, 0, 3]);
    expect(next.window?.kind).toBe("pass");
  });
});

describe("a limit and a choice of different options", () => {
  it("The Tree People can be played once each phase: it returns a Silvan ally and puts another into play from the top 5 cards", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const first = put(state, "08009", "hand");
    const second = put(first.state, "08009", "hand");
    const ally = put(second.state, "silvan", "play");
    const found = put(put(ally.state, "filler", "deck").state, "silvan", "deck");
    const played = settle(expectOk(reduce(found.state, { type: "PlayCard", cardId: first.id, payments: [] }, ctx)).state, ctx);
    expect(played.cards[found.id]?.zone).toBe("play");
    expect(played.cards[ally.id]?.zone).toBe("hand");
    expect(legalIntents(played, ctx)).not.toContainEqual({ type: "PlayCard", cardId: second.id });
  });

  it("The White Council: a player cannot choose the same option as another player", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["lead"], ["tac"]]);
    const event = put(state, "08010", "hand");
    const deck = put(put(put(put(event.state, "filler", "deck", 0).state, "filler", "deck", 1).state, "filler", "deck", 0).state, "filler", "deck", 1);
    const played = expectOk(reduce(deck.state, { type: "PlayCard", cardId: event.id, payments: [] }, ctx)).state;
    expect(played.window?.kind).toBe("choose");
    const first = played.window?.kind === "choose" ? played.window.options : [];
    expect(first).toContain("draw");
    const next = expectOk(reduce(played, { type: "Choose", optionId: "draw" }, ctx)).state;
    expect(next.window?.kind === "choose" ? next.window.options : []).not.toContain("draw");
  });
});

import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS as DECK } from "../../../effects/authored/families/deck.ts";

import { expectOk } from "../../core/test-fixture.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { card, put, table } from "../costs/fixture.ts";

// Rules: rr.play-and-put-into-play, rr.search, rr.in-play-and-out-of-play, rr.attachment-cards, rr.cost (data/rules/entries.json).
// The deck family's records that play cards from the discard pile and put cards into play from the deck.

const book = card("06059", "attachment", "tactics", 1);
const tacEvent = card("tacevent", "event", "tactics", 1);
const loreEvent = card("loreevent", "event", "lore", 1);
const tale = card("131014", "event", "leadership", 0);
const big = card("big", "ally", "neutral", 3);
const small = card("small", "ally", "neutral", 1);
const raven = card("raven", "ally", "neutral", 1);
const RECORDS: readonly Effect[] = [...DECK, { id: "tacevent:action:1", cardCode: "tacevent", lines: ["tacevent:A:1"], timing: "action", instructions: [] }];
const CARDS = [book, tacEvent, loreEvent, tale, big, small, raven];

function chosen(state: ScenarioState, ctx: Parameters<typeof reduce>[2], ...options: string[]): ScenarioState {
  let next = state;
  for (const optionId of options) next = expectOk(reduce(next, { type: "Choose", optionId }, ctx)).state;
  return next;
}

function attached(state: ScenarioState, id: string, host: string): ScenarioState {
  const found = state.cards[id];
  return found ? updateCard(state, id, { host }) : state;
}

describe("playing an event from the discard pile", () => {
  it("Book of Eldacar discards itself to play a Tactics event from the discard pile, which then goes to the bottom of the deck", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["tac"]]);
    const tome = put(state, "06059", "play");
    const event = put(attached(tome.state, tome.id, ids[0]?.[0] ?? ""), "tacevent", "discard");
    const under = put(event.state, "raven", "deck");
    const used = expectOk(reduce(under.state, { type: "Trigger", cardId: tome.id, effectId: "06059:action:1" }, ctx)).state;
    const done = used.window?.kind === "choose" ? chosen(used, ctx, event.id) : used;
    expect(done.cards[tome.id]?.zone).toBe("discard");
    expect(done.seats[0].deck.at(-1)).toBe(event.id);
  });

  it("Book of Eldacar is not offered when the discard pile holds no Tactics event", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["tac"]]);
    const tome = put(state, "06059", "play");
    const other = put(attached(tome.state, tome.id, ids[0]?.[0] ?? ""), "loreevent", "discard");
    expect(legalIntents(other.state, ctx)).not.toContainEqual({ type: "Trigger", cardId: tome.id, effectId: "06059:action:1" });
  });
});

describe("discarding from the deck and putting allies into play", () => {
  it("A Very Good Tale: the total cost of the allies put into play cannot exceed that of the allies exhausted", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const first = put(state, "small", "play");
    const second = put(first.state, "small", "play");
    const event = put(second.state, "131014", "hand");
    const deck = put(put(put(event.state, "big", "deck").state, "big", "deck").state, "small", "deck");
    let next = expectOk(reduce(deck.state, { type: "PlayCard", cardId: event.id, payments: [] }, ctx)).state;
    for (let guard = 0; guard < 12 && next.window?.kind === "choose"; guard += 1) next = chosen(next, ctx, next.window.options[0] ?? "");
    const entered = Object.values(next.cards).filter((c) => c.zone === "play" && !c.exhausted);
    expect(entered.reduce((sum, c) => sum + (c.code === "big" ? 3 : 1), 0)).toBeLessThanOrEqual(2);
    expect(next.cards[first.id]?.exhausted).toBe(true);
    expect(next.cards[second.id]?.exhausted).toBe(true);
  });
});

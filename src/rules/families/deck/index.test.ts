import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/deck.ts";

import { expectOk } from "../../core/test-fixture.ts";
import { reduce } from "../../engine/reduce.ts";
import { withThreat, type ScenarioState } from "../../core/state.ts";
import { card, put, table } from "../costs/fixture.ts";

// Rules: rr.search, rr.play-and-put-into-play, rr.in-play-and-out-of-play, rr.discard-pile-and-victory-display,
// rr.removed-from-game, rr.ownership-and-control (data/rules/entries.json).
// The deck family's records: moving cards between the deck, the hand, the discard pile and play.

const will = card("01049", "event", "neutral", 3);
const fate = card("01054", "event", "neutral", 3);
const search = card("01067", "event", "neutral", null);
const raven = card("raven", "ally", "neutral", 1);
const tale = card("131014", "event", "neutral", 0);
const drinking = card("19116", "event", "neutral", 2);
const gondor = card("gondor", "ally", "neutral", 1, { traits: ["Gondor"] });
const soldier = card("22002", "ally", "neutral", 1, { traits: ["Gondor"] });
const haleth = card("22140", "ally", "neutral", 1);
const gear = card("gear", "attachment", "neutral", 1);
const book = card("06059", "attachment", "neutral", 1);
const strike = card("strike", "event", "neutral", 0);
const dead = card("deadhero", "hero", "lore", null, { threat: 5 });
const CARDS = [will, fate, search, raven, tale, drinking, gondor, soldier, haleth, gear, book, strike, dead];

function chosen(state: ScenarioState, ctx: Parameters<typeof reduce>[2], ...options: string[]): ScenarioState {
  let next = state;
  for (const optionId of options) next = expectOk(reduce(next, { type: "Choose", optionId }, ctx)).state;
  return next;
}

describe("moving cards between the deck, the hand and the discard pile", () => {
  it("Will of the West shuffles the chosen player's discard pile into the deck and is removed from the game", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const event = put(state, "01049", "hand");
    const one = put(event.state, "raven", "discard");
    const two = put(one.state, "gondor", "discard");
    const played = expectOk(reduce(two.state, { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 3 }] }, ctx)).state;
    const done = played.window?.kind === "choose" ? chosen(played, ctx, played.window.options[0] ?? "") : played;
    expect([...done.seats[0].deck].sort()).toEqual([one.id, two.id].sort());
    expect(done.cards[event.id]?.zone).toBe("removed");
    expect(done.seats[0].discard).toEqual([]);
  });

  it("Fortune or Fate puts a hero from a discard pile into play under its owner's control", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"], ["tac"]]);
    const fallen = put(state, "deadhero", "discard", 1);
    const event = put(fallen.state, "01054", "hand");
    const played = expectOk(reduce(event.state, { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 3 }] }, ctx)).state;
    const done = played.window?.kind === "choose" ? chosen(played, ctx, fallen.id) : played;
    expect(done.cards[fallen.id]).toMatchObject({ zone: "heroes", controller: 1 });
  });

  it("Drinking Song shuffles the hand into the deck and draws as many cards", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const event = put(state, "19116", "hand");
    const a = put(event.state, "raven", "hand");
    const b = put(a.state, "gondor", "hand");
    const filler = put(put(put(b.state, "raven", "deck").state, "raven", "deck").state, "gondor", "deck");
    const played = expectOk(reduce(filler.state, { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 2 }] }, ctx)).state;
    expect(played.seats[0].hand.length).toBe(2);
    expect(played.seats[0].hand.length + played.seats[0].deck.length).toBe(5);
  });
});

describe("searching the deck", () => {
  it("Soldier of Gondor takes one Gondor ally at threat below 40", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const first = put(put(state, "gondor", "deck").state, "gondor", "deck");
    const ally = put(first.state, "22002", "hand");
    const played = expectOk(reduce(ally.state, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 1 }] }, ctx)).state;
    const used = expectOk(reduce(played, { type: "Trigger", cardId: ally.id, effectId: "22002:response:1" }, ctx)).state;
    const done = used.window?.kind === "choose" ? chosen(used, ctx, used.window.options[0] ?? "") : used;
    expect(done.seats[0].hand.length).toBe(1);
    expect(done.seats[0].deck.length).toBe(1);
  });

  it("Soldier of Gondor takes any number of Gondor allies at threat 40 or higher", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const first = put(put(withThreat(state, 0, 40), "gondor", "deck").state, "gondor", "deck");
    const ally = put(put(first.state, "gondor", "deck").state, "22002", "hand");
    const played = expectOk(reduce(ally.state, { type: "PlayCard", cardId: ally.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 1 }] }, ctx)).state;
    let next = expectOk(reduce(played, { type: "Trigger", cardId: ally.id, effectId: "22002:response:1" }, ctx)).state;
    for (let guard = 0; guard < 10 && next.window?.kind === "choose"; guard += 1) next = chosen(next, ctx, next.window.options.find((option) => option !== "done") ?? "");
    expect(next.seats[0].hand.length).toBeGreaterThanOrEqual(2);
  });
});

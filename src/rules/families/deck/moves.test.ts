import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/deck.ts";

import { expectOk } from "../../fixture.ts";
import { legalIntents, reduce } from "../../reduce.ts";
import { destroyCard } from "../../keywords.ts";
import { withThreat, type ScenarioState } from "../../state.ts";
import { card, put, table } from "../costs/fixture.ts";

// Rules: rr.search, rr.play-and-put-into-play, rr.in-play-and-out-of-play, rr.discard-pile-and-victory-display,
// rr.ownership-and-control, rr.response, rr.limits (data/rules/entries.json).
// The deck family's records that look at, arrange, discard from and move cards of a deck, and the Responses that move a card
// out of the discard pile.

const gandalf = card("01067", "event", "neutral", null, { costX: true });
const gildor = card("02079", "ally", "neutral", 1);
const zigil = card("03009", "ally", "neutral", 1);
const initiative = card("04002", "event", "neutral", 0);
const rally = card("10003", "event", "neutral", 0);
const harp = card("10090", "attachment", "neutral", 1);
const cheap = card("cheap", "ally", "neutral", 1);
const dear = card("dear", "ally", "neutral", 3);
const gear = card("gear", "attachment", "neutral", 1);
const CARDS = [gandalf, gildor, zigil, initiative, rally, harp, cheap, dear, gear];

function settle(state: ScenarioState, ctx: Parameters<typeof reduce>[2], pick: (options: readonly string[]) => string = (options) => options[0] ?? ""): ScenarioState {
  let next = state;
  for (let guard = 0; guard < 30; guard += 1) {
    if (next.window?.kind === "choose") next = expectOk(reduce(next, { type: "Choose", optionId: pick(next.window.options) }, ctx)).state;
    else if (next.window?.kind === "look") next = expectOk(reduce(next, { type: "Pass" }, ctx)).state;
    else break;
  }
  return next;
}

describe("looking at the top of a deck", () => {
  it("Gandalf's Search looks at the top X cards, adds one to its owner's hand and returns the rest to the top", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const event = put(state, "01067", "hand");
    const a = put(event.state, "cheap", "deck");
    const b = put(a.state, "dear", "deck");
    const c = put(b.state, "gear", "deck");
    const played = expectOk(reduce(c.state, { type: "PlayCard", cardId: event.id, payments: [{ heroId: ids[0]?.[0] ?? "", amount: 2 }] }, ctx)).state;
    const done = settle(played, ctx, (options) => (options.includes(b.id) ? b.id : (options[0] ?? "")));
    expect(done.seats[0].hand).toContain(b.id);
    expect(done.seats[0].deck.length).toBe(2);
    expect(done.seats[0].deck).not.toContain(b.id);
  });

  it("Gildor Inglorion switches a card of the top 3 with a card from the hand", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const ally = put(state, "02079", "play");
    const held = put(ally.state, "gear", "hand");
    const x = put(held.state, "cheap", "deck");
    const y = put(x.state, "cheap", "deck");
    const z = put(y.state, "dear", "deck");
    const used = expectOk(reduce(z.state, { type: "Trigger", cardId: ally.id, effectId: "02079:action:1" }, ctx)).state;
    const done = settle(used, ctx, (options) => (options.includes(z.id) ? z.id : (options.includes(held.id) ? held.id : (options[0] ?? ""))));
    expect(done.seats[0].hand).toContain(z.id);
    expect(done.seats[0].deck).toContain(held.id);
    expect(done.seats[0].deck.length).toBe(3);
    expect(done.cards[ally.id]?.exhausted).toBe(true);
  });
});

describe("discarding from the deck", () => {
  it("Zigil Miner adds a resource to a hero for each discarded card whose cost is the named number", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]], 0);
    const ally = put(state, "03009", "play");
    const a = put(ally.state, "cheap", "deck");
    const b = put(a.state, "cheap", "deck");
    const used = expectOk(reduce(b.state, { type: "Trigger", cardId: ally.id, effectId: "03009:action:1" }, ctx)).state;
    const done = settle(used, ctx, (options) => (options.includes("x1") ? "x1" : (options[0] ?? "")));
    expect(done.seats[0].discard.length).toBe(2);
    expect(done.cards[ids[0]?.[0] ?? ""]?.resources).toBe(2);
  });

  it("Taking Initiative draws 2 cards when the discarded card costs at least as much as the characters you control", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const event = put(state, "04002", "hand");
    const top = put(event.state, "dear", "deck");
    const drawn = put(put(put(top.state, "gear", "deck").state, "gear", "deck").state, "gear", "deck");
    const played = expectOk(reduce(drawn.state, { type: "PlayCard", cardId: event.id, payments: [] }, ctx)).state;
    const done = settle(played, ctx);
    expect(done.seats[0].hand.length).toBe(2);
    expect(ids[0]).toBeDefined();
  });
});

describe("a card going back to the hand from the discard pile", () => {
  it("Rallying Cry's Valour Action sends every ally that leaves play this phase to its owner's hand", () => {
    const { state, ids, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const event = put(withThreat(state, 0, 40), "10003", "hand");
    const ally = put(event.state, "cheap", "play");
    const played = settle(expectOk(reduce(ally.state, { type: "PlayCard", cardId: event.id, payments: [] }, ctx)).state, ctx);
    expect(ids[0]).toBeDefined();
    const gone = destroyCard(played, ally.id, ctx.cards, []);
    expect(gone.cards[ally.id]?.zone).toBe("hand");
  });

  it("Rallying Cry's Valour Action is not offered below 40 threat", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const event = put(withThreat(state, 0, 39), "10003", "hand");
    expect(legalIntents(event.state, ctx)).not.toContainEqual({ type: "PlayCard", cardId: event.id });
  });

  it("an ally destroyed without the Valour Action goes to the discard pile", () => {
    const { state, ctx } = table(RECORDS, CARDS, [["lead"]]);
    const ally = put(state, "cheap", "play");
    expect(destroyCard(ally.state, ally.id, ctx.cards, []).cards[ally.id]?.zone).toBe("discard");
  });
});

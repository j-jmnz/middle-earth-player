// Rules: rr.play-and-put-into-play (data/rules/entries.json). Elven-light (10145:A:1) is played only from the discard pile,
// which the table does not draw card by card: the pile glows, the window's note says to tap it, and its list plays the card.
import { describe, expect, it } from "vitest";

import { RECORDS as DECK } from "../effects/authored/families/deck.ts";
import { RECORDS as TDR } from "../effects/authored/pool/TDR.ts";
import { expectOk } from "../rules/fixture.ts";
import { card, put, table } from "../rules/families/costs/fixture.ts";
import { legalIntents, reduce } from "../rules/reduce.ts";

import { windowSheet } from "./bar-sheets.ts";
import { highlightKeys } from "./highlight-of.ts";
import { discardPlays } from "./table-choice.ts";

const names = { card: (id: string) => (id === "i2" ? "Elven-light" : id), line: () => null };
const CARDS = [card("10145", "event", "spirit", 1), card("filler", "ally", "neutral", 1)];

function parked() {
  const { state, ids, ctx } = table([...DECK, ...TDR], CARDS, [["spirit"]]);
  const light = put(state, "10145", "discard");
  const deck = put(light.state, "filler", "deck");
  return { state: deck.state, light: light.id, hero: ids[0]?.[0] ?? "", ctx };
}

describe("playing Elven-light from the discard pile", () => {
  it("the window names it as a play from the pile, and the pile glows", () => {
    const { state, light, ctx } = parked();
    const legal = legalIntents(state, ctx);
    const sheet = windowSheet(state, ctx, legal, names);
    expect(discardPlays(state, 0, sheet)).toEqual([light]);
    expect(sheet.note).toContain("Tap your discard pile to play Elven-light from it.");
    const keys = highlightKeys({ game: state, seat: 0, sheet, choice: { key: sheet.key, ids: [], shares: [] }, panel: false });
    expect(keys.glow.split(",")).toContain("pile:discard");
  });

  it("played from the pile, it returns to the hand and its player draws 1 card", () => {
    const { state, light, hero, ctx } = parked();
    const played = expectOk(reduce(state, { type: "PlayCard", cardId: light, payments: [{ heroId: hero, amount: 1 }] }, ctx)).state;
    expect(played.cards[light]?.zone).toBe("hand");
    expect(played.seats[0].hand).toHaveLength(2);
  });

  it("in the hand, it is not playable and the pile does not glow", () => {
    const { state, light, ctx } = parked();
    const inHand = expectOk(reduce(state, { type: "PlayCard", cardId: light, payments: [{ heroId: parked().hero, amount: 1 }] }, ctx)).state;
    const sheet = windowSheet(inHand, ctx, legalIntents(inHand, ctx), names);
    expect(sheet.plays).not.toContain(light);
    expect(discardPlays(inHand, 0, sheet)).toEqual([]);
  });
});


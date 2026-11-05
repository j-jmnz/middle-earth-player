// Rules: rr.play-and-put-into-play (data/rules/entries.json). A screen reader hears the window's readerNote in place of the note that names a glow or a
// drag: the words its buttons say ("Can be played"), and the discard pile it taps. The visible note is what it always was.
import { describe, expect, it } from "vitest";

import { RECORDS as FOTW } from "../../effects/authored/pool/FotW.ts";
import { RECORDS as DECK } from "../../effects/authored/families/deck.ts";
import { RECORDS as TDR } from "../../effects/authored/pool/TDR.ts";
import { actionWindow, fighter, table as attackTable } from "../../rules/families/attack/fixture.ts";
import { card, put, table } from "../../rules/families/costs/fixture.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";

import { windowSheet } from "./bar-sheets.ts";

const names = { card: (id: string) => (id === "i2" ? "Elven-light" : id), line: () => null };
const CARDS = [card("10145", "event", "spirit", 1), card("filler", "ally", "neutral", 1)];

function open() {
  const { state, ctx } = table([...DECK, ...TDR], CARDS, [["spirit"]]);
  const light = put(state, "10145", "discard");
  const deck = put(light.state, "filler", "deck");
  return { state: deck.state, ctx };
}

describe("the window sheet's readerNote", () => {
  it("replaces the glow and the drag with the words a card says, and keeps the pile note", () => {
    const { state, ctx } = open();
    const sheet = windowSheet(state, ctx, legalIntents(state, ctx), names);
    expect(sheet.readerNote).toContain("Tap your discard pile to play Elven-light from it.");
    // The visible note is unchanged.
    expect(sheet.note).toContain("Tap your discard pile to play Elven-light from it.");
  });

  it("says a card that can be played, and never a glow or a drag", () => {
    const { state, ctx } = table([...DECK, ...TDR], CARDS, [["spirit"]]);
    const hand = put(state, "filler", "hand");
    const sheet = windowSheet({ ...hand.state, mode: "planning" }, ctx, legalIntents({ ...hand.state, mode: "planning" }, ctx), names);
    if (sheet.plays.length === 0) throw new Error("a card to play");
    expect(sheet.note).toBe("Tap a glowing card to play it, or drag it.");
    expect(sheet.readerNote).toBe("Cards that say 'can be played' can be played now.");
    expect(sheet.readerNote).not.toMatch(/glow|drag/i);
  });

  it("says nothing can be played when nothing can", () => {
    const { state, ctx } = table([...DECK, ...TDR], CARDS, [["spirit"]]);
    const planning = { ...state, mode: "planning" as const };
    const sheet = windowSheet(planning, ctx, legalIntents(planning, ctx), names);
    expect(sheet.plays).toEqual([]);
    expect(sheet.readerNote).toBe("Nothing in your hand can be played now.");
    expect(sheet.note).toBe("Nothing in your hand can be played now.");
  });
});

describe("the action window's readerNote", () => {
  it("says a card that can be used, in place of the glow", () => {
    const { state, ctx } = attackTable([{ code: "145002", at: { zone: "heroes", seat: 0 } }], FOTW.filter((effect) => effect.cardCode === "145002"), [fighter("145002")]);
    const window = actionWindow(state);
    const sheet = windowSheet(window, ctx, legalIntents(window, ctx), names);
    expect(sheet.note).toContain("Tap a glowing card to use it.");
    expect(sheet.readerNote).toContain("Cards that say 'can use' can be used now.");
    expect(sheet.readerNote).not.toMatch(/glow|drag/i);
  });
});

// Rules: rr.search, rr.traits (data/rules/entries.json); ledger line 146073:A:1: "searches the encounter deck and discard pile for a different Orc, Troll, or Nazgûl enemy".
import { describe, expect, it } from "vitest";

import { definePrinted } from "../core/printed.ts";
import { cardMap } from "../core/test-fixture.ts";
import { spawn } from "../core/zones.ts";
import { enemy, hero, table } from "../families/defense/table.ts";
import { searchable } from "./search.ts";

const cards = [hero("a"), enemy("orc", { traits: ["Orc"] }), enemy("troll", { traits: ["Troll", "Mordor"] }), enemy("nazgul", { traits: ["Nazgûl"] }), enemy("warg", { traits: ["Wolf"] }), definePrinted({ code: "ring", name: "ring", type: "treachery", traits: ["Orc"] })];

describe("search selector traits (146073:A:1)", () => {
  it("finds a card with any one of the traits, in the deck and in the discard pile", () => {
    const base = table({ cards, effects: [], heroes: [{ code: "a" }] });
    let state = base.state;
    for (const [code, zone] of [["orc", "encounterDeck"], ["troll", "encounterDiscard"], ["nazgul", "encounterDeck"], ["warg", "encounterDeck"], ["ring", "encounterDeck"]] as const) state = spawn(state, code, { zone }).state;
    const ctx = { effects: [], cards: cardMap(cards) };
    const found = searchable(state, { traits: ["Orc", "Troll", "Nazgûl"], type: "enemy" }, ctx).map((id) => state.cards[id]?.code);
    expect(found.sort()).toEqual(["nazgul", "orc", "troll"]);
    // One trait alone is the old selector.
    expect(searchable(state, { trait: "Wolf" }, ctx).map((id) => state.cards[id]?.code)).toEqual(["warg"]);
  });

  it("reads the victory display only when asked (146036:A:2)", () => {
    const base = table({ cards, effects: [], heroes: [{ code: "a" }] });
    const state = spawn(spawn(base.state, "nazgul", { zone: "encounterDeck" }).state, "nazgul", { zone: "victory" }).state;
    const ctx = { effects: [], cards: cardMap(cards) };
    expect(searchable(state, { traits: ["Nazgûl", "Orc"], type: "enemy" }, ctx)).toHaveLength(1);
    expect(searchable(state, { traits: ["Nazgûl", "Orc"], type: "enemy", victory: true }, ctx)).toHaveLength(2);
  });
});

// Rules: dcce.grotto-deck, dcce.uncharted-deck (data/rules/entries.json). The Grotto deck is a pile of the table's second slot, named and read as itself: "Grotto deck" on the list and to a screen reader, "Grotto" under
// the pile, drawn as its top card's Grotto side (the side the players may look at), never as the Uncharted deck's Lost Island, and never the Underwater side behind it.
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, loadRuinsWorld, ruinsTable, type RuinsWorld } from "../../../test/scenarios/the-drowned-ruins/scene.ts";

import { pileSpeech } from "../canvas/pile-speech.ts";
import { grottoTop } from "../chrome/use-table-wiring.ts";
import { tableLayout, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { PILES, PILE_WORDS, TABLE_ZONES, opensList, pileSelector, secondPilesOf } from "./selectors.ts";

let world: RuinsWorld;

beforeAll(async () => {
  world = await loadRuinsWorld();
});

const PAIRS = [
  { code: CODES.underseaGrotto, back: "12101", pile: "grottoDeck" as const },
  { code: CODES.cursedCaverns, back: "12102", pile: "grottoDeck" as const },
  { code: CODES.waterLoggedHalls, back: "12103", pile: "grottoDeck" as const },
];

describe("the Grotto deck pile", () => {
  it("is the second slot's pile while a game deals the Grotto deck, and a table without one is unchanged", () => {
    expect(secondPilesOf(ruinsTable(world, {}).state)).toEqual([]);
    const made = ruinsTable(world, { doubleSided: PAIRS });
    expect(secondPilesOf(made.state)).toEqual(["grottoDeck"]);
    const view = pileSelector("grottoDeck", 0)(made.state);
    expect(view.ids).toHaveLength(3);
    // Its top card lies Grotto side up.
    expect(view.top).toMatchObject({ code: view.top?.code, face: "up" });
    expect(["12098", "12099", "12100"]).toContain(view.top?.code);
    expect(secondPilesOf({ corsairDeck: [], uncharted: made.state.uncharted })).toEqual(["corsairDeck", "corsairDiscard"]);
  });

  it("is named the Grotto deck on the list and to a screen reader with its top card, and opens that card, not a list", () => {
    expect(PILE_WORDS.grottoDeck).toBe("Grotto deck");
    expect(pileSpeech({ zone: "grottoDeck", count: 6 })).toEqual({ label: "Grotto deck, 6 cards", hint: null });
    expect(pileSpeech({ zone: "grottoDeck", count: 6 }, false, "Undersea Grotto")).toEqual({ label: "Grotto deck, 6 cards, Undersea Grotto on top", hint: "Opens the top card" });
    expect(opensList("grottoDeck")).toBe(false);
    // A tap or a long press opens the top card as it lies (Grotto side), and only in a game that deals the Grotto deck.
    const made = ruinsTable(world, { doubleSided: PAIRS });
    const top = grottoTop(made.state);
    expect(top).toBe(made.state.uncharted?.deck[0]);
    expect(made.state.cards[top ?? ""]?.code).toBe(pileSelector("grottoDeck", 0)(made.state).top?.code);
    expect(grottoTop(ruinsTable(world, {}).state)).toBeUndefined();
    expect(pileSpeech({ zone: "unchartedDeck", count: 5 }).label).toBe("Uncharted deck, 5 cards");
  });

  it("is drawn as its top card's Grotto side in the second slot's left place, and is no Uncharted deck", () => {
    const made = ruinsTable(world, { doubleSided: PAIRS });
    const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, { zone, seat: 0, entries: [] }])) as unknown as LayoutViews;
    const base = Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, 0)(made.state)])) as unknown as PileViews;
    const piles: PileViews = { ...base, grottoDeck: pileSelector("grottoDeck", 0)(made.state) };
    const layout = tableLayout(591, 338, views, piles, {});
    const slot = layout.slots.find((item) => item.id === "pile:grottoDeck");
    expect(slot).toMatchObject({ zone: "grottoDeck", kind: "pile", count: 3, faceDown: false });
    expect(slot?.picture).toBe(piles.grottoDeck?.top?.code);
    expect(layout.piles.grottoDeck).toMatchObject({ x: layout.piles.encounterDeck.x });
    expect(layout.slots.some((item) => item.zone === "unchartedDeck")).toBe(false);
  });
});

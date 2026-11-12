import { describe, expect, it } from "vitest";

import { definePrinted, type PrintedCard } from "../rules/core/printed.ts";
import type { DeckSaveCard } from "../catalog/deck-save.ts";

import { loadoutProblems } from "./briefing.ts";
import { stolenAfter } from "./log-angmar-awakened.ts";
import type { World } from "./world.ts";

// Rules: mec108.captured-deck, mec108.campaign-log, rr.deckbuilding (data/rules/entries.json); ledger line 10174:B:3. The unique cards still in a player's captured deck when Escape from Mount Gram is won are recorded for that player; the loadout refuses them in that
// player's deck and as that player's hero in every later part (the deck builder's ready-to-play check, src/campaign/briefing.ts loadoutProblems).
const FILLERS = Array.from({ length: 17 }, (_, index) => `c${index}`);
const cards = new Map<string, PrintedCard>([
  ["h1", definePrinted({ code: "h1", name: "Hero One", type: "hero", sphere: "tactics", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3, isUnique: true })],
  ["h2", definePrinted({ code: "h2", name: "Hero Two", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3, isUnique: true })],
  ["a1", definePrinted({ code: "a1", name: "Unique Ally", type: "ally", sphere: "neutral", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2, isUnique: true })],
  ...FILLERS.map((code): [string, PrintedCard] => [code, definePrinted({ code, name: `Filler ${code}`, type: "event", sphere: "neutral", cost: 0 })]),
]);
const deckFacts = new Map<string, DeckSaveCard>([
  ...FILLERS.map((code): [string, DeckSaveCard] => [code, { name: `Filler ${code}`, typeCode: "event", sphereCode: "neutral", deckLimit: null, deckLegal: true, traits: null }]),
  ...["h1", "h2"].map((code): [string, DeckSaveCard] => [code, { name: cards.get(code)?.name ?? code, typeCode: "hero", sphereCode: "lore", deckLimit: 1, deckLegal: true, traits: null }]),
  ["a1", { name: "Unique Ally", typeCode: "ally", sphereCode: "neutral", deckLimit: 1, deckLegal: true, traits: null }],
]);
const FIFTY = FILLERS.flatMap((code) => [code, code, code]);
const world = { cards, deckFacts, effects: [], campaign: { saga: false }, scenario: {} } as unknown as World;
const seat = (heroes: readonly string[], deck: readonly string[]) => ({ deckId: "d", heroes, deck });
const check = (seats: ReturnType<typeof seat>[], stolen: readonly (readonly string[])[]) => loadoutProblems({ world, seatCount: seats.length as 1 | 2, seats, ringBearer: null }, [], [], [], stolen).problems.map((problem) => `${problem.rule}: ${problem.message}`);

describe("10174:B:3 stolen cards", () => {
  it("refuses a stolen unique card in that player's deck and as that player's hero, and no other player's", () => {
    const stolen = [["a1", "h2"], []];
    expect(check([seat(["h1"], [...FIFTY, "a1"])], stolen)).toEqual([expect.stringContaining("A unique card the Goblins stole: Unique Ally (a1)")]);
    expect(check([seat(["h2"], FIFTY)], stolen)).toEqual([expect.stringContaining("A unique card the Goblins stole: Hero Two (h2)")]);
    expect(check([seat(["h1"], FIFTY), seat(["h2"], [...FIFTY, "a1"])], stolen)).toEqual([]);
    expect(check([seat(["h1"], [...FIFTY, "a1"])], [[], []])).toEqual([]);
  });

  it("adds each seat's newly stolen cards to the logged ones once each", () => {
    expect(stolenAfter([["a1"], []], [["a1", "h2"], ["h1"]])).toEqual([["a1", "h2"], ["h1"]]);
    expect(stolenAfter([["a1"], []], undefined)).toEqual([["a1"], []]);
  });
});

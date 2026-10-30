import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encounterCodes, placementsAt, setupInstructions } from "../../src/catalog/scenario-data.ts";
import { loadCards } from "./load-cards.ts";
import { loadScenarios } from "./load-scenarios.ts";
import { isNightmareCard, NIGHTMARE_DECKS, nightmareCode, nightmareDeckOfCode } from "./nightmare-defs.ts";
import { removalLines } from "./normalize/nightmare.ts";
import { RAW_DIR } from "./paths.ts";
import { namesMatch, type DriveFile } from "./sources/jvzijp.ts";
import { cardListPath, deckFiles, nightmareFiles, parseCardList, parseNightmareFile } from "./sources/nightmare.ts";

// The Nightmare decks (docs/plans/nightmare-mode.md): every card of the 72 decks is built, each deck's card list on Drive agrees
// with Hall of Beorn's copies, every side but one has its picture, and the nine built scenarios that have a deck carry it.
const cards = loadCards();
const nightmare = cards.filter(isNightmareCard);
const listing = JSON.parse(readFileSync(path.join(RAW_DIR, "nightmare", "drive.json"), "utf8")) as DriveFile[];
const deckOf = nightmareDeckOfCode;

// Where the card list and Hall of Beorn disagree on copies, with what settles it.
const COPIES_SETTLED: Readonly<Record<string, { copies: number; reason: string }>> = {
  // The list (and the file name) say 4; the card prints "4/19", a set of 19 encounter cards, which Hall of Beorn's 3 make.
  "Breaking of the Fellowship Nightmare:Isengard Tracker": { copies: 3, reason: "the printed set total 19" },
};

describe("Nightmare decks", () => {
  it("builds every card of all 72 decks under its deck's prefix, one setup card each", () => {
    expect(NIGHTMARE_DECKS).toHaveLength(72);
    expect(nightmare).toHaveLength(637);
    for (const deck of NIGHTMARE_DECKS) {
      const mine = nightmare.filter((card) => deckOf(card.code) === deck);
      // The setup card is collector number 1, except where a deck numbers on from its pack's other decks (The Weather Hills' is 11).
      expect(mine.filter((card) => card.type === "nightmare"), deck.set).toHaveLength(1);
      expect(mine.every((card) => card.code === nightmareCode(deck, card.printings[0]?.number ?? 0)), deck.set).toBe(true);
      expect(mine.every((card) => !card.deckLegal), deck.set).toBe(true);
    }
    expect(nightmare.every((card) => deckOf(card.code) != null)).toBe(true);
  });

  it("agrees with each deck's card list on Drive, copy for copy", () => {
    const problems: string[] = [];
    for (const deck of NIGHTMARE_DECKS) {
      // A list names a double-sided card by both sides ("Shrine to Morgoth / Lost Island", "2A - Searching for an Exit / 2B - …"),
      // and leaves the quest cards out.
      // A row's sides are each counted: Hall of Beorn has a card for each face of The Drowned Ruins' double-sided locations.
      const listed = new Map<string, number>();
      for (const row of parseCardList(readFileSync(path.join(RAW_DIR, cardListPath(deck)), "utf8"))) {
        if (/^\d+[AB]\b/.test(row.name)) continue;
        for (const face of row.name.split(" / ").map((part) => part.replaceAll("&", "and"))) listed.set(face, (listed.get(face) ?? 0) + row.copies);
      }
      const copies = new Map<string, number>();
      for (const card of nightmare.filter((item) => deckOf(item.code) === deck && item.type !== "nightmare" && item.type !== "quest")) copies.set(card.name, (copies.get(card.name) ?? 0) + card.quantity);
      // An exact title first, so Isengard Archer is not read as Isengard Tracker.
      const rowOf = (name: string) => [...listed].find(([listedName]) => listedName.toLowerCase() === name.toLowerCase()) ?? [...listed].find(([listedName]) => namesMatch(name, listedName));
      for (const [name, count] of copies) {
        const row = rowOf(name);
        const settled = COPIES_SETTLED[`${deck.set}:${name}`];
        if (!row) problems.push(`${deck.set}: ${name} is not on the list`);
        else if (row[1] !== count && settled?.copies !== count) problems.push(`${deck.set}: ${name} ${count}, the list ${row[1]}`);
      }
      // A back the list names (Lost Island, Edge of the Temple) is the back of the cards it pairs with, not a card of its own.
      const backs = new Set(nightmare.filter((item) => deckOf(item.code) === deck).flatMap((item) => (item.back?.name ? [item.back.name] : [])));
      for (const name of listed.keys()) if (![...copies.keys(), ...backs].some((card) => namesMatch(card, name)) && !/^(Lost Island|Edge of the Temple)$/.test(name)) problems.push(`${deck.set}: the list's ${name} is no card`);
    }
    expect(problems).toEqual([]);
  });

  it("finds a picture for every side but the back of Raid on the Grey Havens' setup card, and uses every card file", () => {
    const missing: string[] = [];
    const used = new Set<string>();
    for (const deck of NIGHTMARE_DECKS) {
      const mine = nightmare.filter((card) => deckOf(card.code) === deck);
      const files = nightmareFiles(deckFiles(listing, deck), mine);
      for (const card of mine) for (const side of card.back ? ["A", "B"] : ["A"]) if (!files.has(`${card.code}.${side}`)) missing.push(`${card.code}.${side}`);
      for (const file of files.values()) used.add(file.id);
    }
    expect(missing).toEqual(["904801.B"]);
    const cardFiles = listing.filter((file) => /\.(jpe?g|png)$/i.test(file.path) && file.path.includes("/") && !/\/000 - /.test(file.path) && !/Introduction/.test(file.path));
    expect(cardFiles.filter((file) => !used.has(file.id)).map((file) => file.path)).toEqual([]);
  });

  it("reads the folder's file names, typos and all", () => {
    const parse = (name: string) => parseNightmareFile({ path: `deck/${name}`, id: "x" });
    expect(parse("002 - Ungoliant's Spawn 1.jpg")).toMatchObject({ number: "002", stage: null, name: "Ungoliant's Spawn", copies: 1 });
    expect(parse("002 Ambushing Orcs 3.jpg")).toMatchObject({ number: "002", name: "Ambushing Orcs", copies: 3 });
    expect(parse("004 -Prison Cell 4.jpg")).toMatchObject({ number: "004", name: "Prison Cell", copies: 4 });
    expect(parse("- - 2A - Search for an Exit.jpg")).toMatchObject({ number: null, stage: "2", side: "A", name: "Search for an Exit" });
    expect(parse("011 - 3B - Grimbeorn's Folly.jpg")).toMatchObject({ number: "011", stage: "3", side: "B" });
    expect(parse("Lost Island.jpg")).toMatchObject({ number: null, name: "Lost Island", copies: null });
    expect(parse("cardlist.txt")).toBeNull();
  });

  it("gives an exact title its own file before a near one (Eastern Shore is not Western Shore's)", () => {
    const deck = NIGHTMARE_DECKS.find((item) => item.set === "The Fords of Isen Nightmare");
    if (!deck) throw new Error("no Fords of Isen deck");
    const files = nightmareFiles(deckFiles(listing, deck), nightmare.filter((card) => deckOf(card.code) === deck));
    const western = nightmare.find((card) => deckOf(card.code) === deck && card.name === "Western Shore");
    const eastern = nightmare.find((card) => deckOf(card.code) === deck && card.name === "Eastern Shore");
    expect(files.get(`${western?.code}.A`)?.path).toMatch(/Western Shore/);
    expect(files.get(`${eastern?.code}.A`)?.path).toMatch(/Eastern Shore/);
  });
});

describe("a built scenario's Nightmare deck", () => {
  const scenarios = loadScenarios();
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const name = (code: string) => cards.find((card) => card.code === code)?.name;

  it("is carried by the nine built scenarios that have one, and by no other", () => {
    const withDeck = scenarios.filter((scenario) => scenario.nightmare).map((scenario) => scenario.id).sort();
    expect(withDeck).toEqual(NIGHTMARE_DECKS.flatMap((deck) => (deck.scenario ? [deck.scenario] : [])).sort());
    expect(byId.get("the-oath")?.nightmare).toBeUndefined();
  });

  it("reads the setup card's removal list in either order it prints", () => {
    expect(removalLines("Begin with…\nRemove the following cards, in the specified quantities, from the standard encounter deck:\n3x Evil Crow\nForest Spider x3\nThen, shuffle…")).toEqual([
      { name: "Evil Crow", copies: 3 },
      { name: "Forest Spider", copies: 3 },
    ]);
  });

  it("deals the standard deck less the removals, with the Nightmare cards shuffled in (A Shadow of the Past)", () => {
    const scenario = byId.get("a-shadow-of-the-past");
    if (!scenario?.nightmare) throw new Error("A Shadow of the Past has no Nightmare deck");
    const normal = encounterCodes(scenario, "Normal");
    const deck = encounterCodes(scenario, "Nightmare");
    const removed = scenario.nightmare.removed.reduce((sum, item) => sum + item.copies, 0);
    const added = scenario.nightmare.cards.reduce((sum, item) => sum + item.copies, 0);
    expect(deck).toHaveLength(normal.length - removed + added);
    expect(deck.filter((code) => name(code) === "Evil Crow")).toHaveLength(0);
    expect(deck.filter((code) => name(code) === "Khamûl the Easterling")).toHaveLength(1);
    expect(deck).not.toContain(scenario.nightmare.setupCard);
  });

  it("stages Nightmare Fell Rider one per player where the Fell Rider it replaces was (Flight to the Ford)", () => {
    const scenario = byId.get("flight-to-the-ford");
    if (!scenario?.nightmare) throw new Error("Flight to the Ford has no Nightmare deck");
    const staged = setupInstructions(scenario, "Nightmare", 2).filter((instruction) => instruction.verb === "AddToStaging" && "code" in instruction && name(instruction.code) === "Fell Rider");
    expect(staged.map((instruction) => ("code" in instruction ? (instruction.code ?? "").slice(0, 4) : null))).toEqual(["9063", "9063"]);
    const nightmareRider = placementsAt(scenario, "Nightmare").find((card) => card.pile === "staging" && name(card.code) === "Fell Rider");
    expect(nightmareRider?.code.startsWith("9063")).toBe(true);
    // The two Riders the players did not take stay in the encounter deck.
    expect(encounterCodes(scenario, "Nightmare", 2).filter((code) => code === nightmareRider?.code)).toHaveLength(2);
  });

  it("leaves a Setup slot empty when the deck prints no card of the removed title (Journey in the Dark's staged Mines of Moria)", () => {
    const scenario = byId.get("journey-in-the-dark");
    if (!scenario?.nightmare) throw new Error("Journey in the Dark has no Nightmare deck");
    const mines = scenario.cards.find((card) => card.pile === "staging" && name(card.code) === "Mines of Moria");
    expect(mines).toBeDefined();
    expect(scenario.nightmare.removed).toContainEqual({ code: mines?.code, copies: 1, pile: "staging" });
    expect(placementsAt(scenario, "Nightmare").some((card) => card.pile === "staging" && name(card.code) === "Mines of Moria")).toBe(false);
  });

  it("leaves Easy and Normal as they were", () => {
    for (const scenario of scenarios) {
      expect(placementsAt(scenario, "Normal")).toBe(scenario.cards);
      expect(placementsAt(scenario, "Easy")).toBe(scenario.cards);
    }
  });
});

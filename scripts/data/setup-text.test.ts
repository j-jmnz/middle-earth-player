import { describe, expect, it } from "vitest";

import type { Card } from "../../src/catalog/card-facts.ts";
import { nameIndex, parseSetup } from "./normalize/setup-text.ts";

// Each sentence is quoted from data/printed/mirkwood-paths.json (the scan-read ledger), not from Hall of Beorn.
const card = (code: string, name: string, type = "enemy"): Card => ({ code, name, type }) as Card;
const CARDS = [
  card("a1", "The Eaves of Mirkwood", "location"),
  card("a2", "Goblin Troop"),
  card("a3", "Goblin Chieftain"),
  card("a4", "Cracked Pillar", "location"),
  card("a5", "Cave Torch", "attachment"),
  card("a6", "Forest Spider"),
  card("a7", "Old Forest Road", "location"),
  card("a8", "Nazgûl of Dol Guldur"),
  card("a9", "Mendor", "attachment"),
  card("b1", "Appointed by Fate", "attachment"),
  card("b2", "Valor", "attachment"),
  card("b3", "Scarred", "attachment"),
  card("b4", "No Time to Waste!", "attachment"),
  card("b5", "Shiny Distraction", "treachery"),
  card("b6", "Stalking Goblin"),
];
const names = nameIndex(CARDS, new Set());
const parse = (text: string) => parseSetup(text, names);

describe("parseSetup: Mirkwood Paths and The Dark of Mirkwood Setup sentences", () => {
  it("01119.A: searches for 1 copy of each and adds them to the staging area", () => {
    const parsed = parse("Setup: Search the encounter deck for 1 copy of the Forest Spider and 1 copy of the Old Forest Road, and add them to the staging area. Then, shuffle the encounter deck.");
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([{ kind: "stage", codes: ["a6", "a7"], perPlayer: null, count: 1 }, { kind: "shuffleEncounterDeck" }]);
  });

  it("01123.A: the 3 objective cards, the Nazgûl alongside the quest deck, 1 encounter card attached to each objective", () => {
    const parsed = parse(
      "Setup: Search the encounter deck for the 3 objective cards, reveal and place them in the staging area. Also, place the Nazgûl of Dol Guldur face up but out of play, alongside the quest deck. Then, shuffle the encounter deck, and attach 1 encounter to each objective card.",
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([
      { kind: "searchObjectives", count: 3 },
      { kind: "aside", codes: ["a8"], allCopies: false },
      { kind: "shuffleEncounterDeck" },
      { kind: "attachEncounterToObjectives", count: 1 },
    ]);
  });

  it("01126.A: each player reveals 1 card from the top of the encounter deck", () => {
    const parsed = parse("Setup: Each player reveals 1 card from the top of the encounter deck, and adds it to the staging area.");
    expect(parsed).toEqual({ clauses: [{ kind: "eachPlayerReveals", count: 1 }], unread: [] });
  });

  it("01129.A and 01131.A: Put Mendor into play, and Appointed by Fate goes to a hero of the first player's choice", () => {
    expect(parse("Setup: Put Mendor into play.")).toEqual({ clauses: [{ kind: "putIntoPlay", codes: ["a9"] }], unread: [] });
    expect(parse("Setup: Put Mendor into play. Attach Appointed by Fate to a hero of the first player's choice.").clauses).toEqual([
      { kind: "putIntoPlay", codes: ["a9"] },
      { kind: "attachChosen", codes: ["b1"], who: "firstPlayer" },
    ]);
  });

  it("01130.A: Set each copy of Valor and Scarred aside, out of play", () => {
    expect(parse("Setup: Put Mendor into play. Set each copy of Valor and Scarred aside, out of play.").clauses).toEqual([
      { kind: "putIntoPlay", codes: ["a9"] },
      { kind: "aside", codes: ["b2", "b3"], allCopies: true },
    ]);
  });

  it("41001.A: searches for 1 copy of two cards, stages one and sets the other aside", () => {
    const parsed = parse(
      "Setup: Search the encounter deck for 1 copy of The Eaves of Mirkwood and Goblin Troop. Add The Eaves of Mirkwood to the staging area and set Goblin Troop aside, out of play. Shuffle the encounter deck.",
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([
      { kind: "search", codes: ["a1", "a2"] },
      { kind: "stage", codes: ["a1"], perPlayer: null, count: 1 },
      { kind: "aside", codes: ["a2"], allCopies: false },
      { kind: "shuffleEncounterDeck" },
    ]);
  });

  it("41004.A: searches for three cards, two go aside and the first player attaches the third", () => {
    const parsed = parse(
      "Setup: Search the encounter deck for Goblin Chieftain, Cracked Pillar, and Cave Torch. Set Goblin Chieftain and Cracked Pillar aside, out of play. The first player attaches Cave Torch to one of his heroes. Shuffle the encounter deck.",
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses).toEqual([
      { kind: "search", codes: ["a3", "a4", "a5"] },
      { kind: "aside", codes: ["a3", "a4"], allCopies: false },
      { kind: "attachChosen", codes: ["a5"], who: "firstPlayer" },
      { kind: "shuffleEncounterDeck" },
    ]);
  });

  it("41050.A: each player chooses 1 Adaptation boon; the burden is shuffled in and both go to the Campaign Pool", () => {
    const parsed = parse(
      "Setup: Each player chooses 1 Adaptation boon attachment and attaches it to one of their heroes. Shuffle the Stalking Goblin burden enemy into the encounter deck. Add Stalking Goblin and each attached Adaptation to the Campaign Pool.",
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses[0]).toEqual({ kind: "eachPlayerChoosesBoon", trait: "Adaptation" });
    expect(parsed.clauses).toContainEqual({ kind: "shuffleInto", codes: ["b6"], into: "encounter deck", set: null });
    expect(parsed.clauses).toContainEqual({ kind: "addToCampaignPool", codes: ["b6"] });
  });

  it("41051.A: each player adds 1 copy of a boon to their hand after the mulligan", () => {
    const parsed = parse(
      'Setup: Each player adds 1 copy of the "No Time to Waste!" boon to their hand after drawing their starting hand (including taking a mulligan). Add each copy of "No Time to Waste!" in a player\'s hand to the Campaign Pool. Shuffle the Shiny Distraction burden into the encounter deck and add it to the Campaign Pool.',
    );
    expect(parsed.unread).toEqual([]);
    expect(parsed.clauses[0]).toEqual({ kind: "addToHandAfterMulligan", codes: ["b4"], count: 1 });
    expect(parsed.clauses).toContainEqual({ kind: "addToCampaignPool", codes: ["b4"] });
    expect(parsed.clauses).toContainEqual({ kind: "shuffleInto", codes: ["b5"], into: "encounter deck", set: null });
  });

  it("reports a search sentence that is not a bare list of names, or that places nothing, as unread", () => {
    expect(parse("Setup: Search the encounter deck for Goblin Troop and discard every other card.").unread).toHaveLength(1);
    // A found card no later clause places.
    expect(parse("Setup: Search the encounter deck for Goblin Troop. Shuffle the encounter deck.").unread).toEqual(["Search the encounter deck for Goblin Troop"]);
  });
});

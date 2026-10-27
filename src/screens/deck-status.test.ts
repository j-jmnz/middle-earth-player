import { describe, expect, it } from "vitest";

import type { DeckSaveCard } from "../catalog/deck-save";
import { copyDeckName, costCurve, deckContentsPhrase, deckCountLine, deckReadiness, deckSections, newDeckName, savedDeckName, sphereSplit, startingThreat } from "./deck-status.ts";

function fact(name: string, typeCode: string, deckLimit: number | null = 3): DeckSaveCard {
  return { name, typeCode, sphereCode: "lore", deckLimit, deckLegal: true, traits: null };
}

const facts = new Map<string, DeckSaveCard>([["h1", fact("Bilbo Baggins", "hero", 1)]]);
const allies = Array.from({ length: 17 }, (_, at) => {
  const code = `a${at}`;
  facts.set(code, fact(`Ally ${at}`, "ally"));
  return { code, count: 3 };
});

describe("deckReadiness", () => {
  it("is ready with a hero and fifty cards", () => {
    expect(deckReadiness({ name: "x", heroes: ["h1"], cards: allies }, facts)).toEqual({ ready: true, text: "Ready to play" });
  });

  it("says how many cards a short deck still needs, and when it needs a hero", () => {
    expect(deckReadiness({ name: "x", heroes: ["h1"], cards: allies.slice(0, 15) }, facts)).toEqual({ ready: false, text: "Needs 5 more cards" });
    expect(deckReadiness({ name: "x", heroes: ["h1"], cards: [...allies.slice(0, 16), { code: "a16", count: 1 }] }, facts)).toEqual({ ready: false, text: "Needs 1 more card" });
    expect(deckReadiness({ name: "x", heroes: [], cards: allies }, facts)).toEqual({ ready: false, text: "Needs a hero" });
  });

  it("names the card and the rule for any other refusal", () => {
    expect(deckReadiness({ name: "x", heroes: ["h1"], cards: [...allies, { code: "zz", count: 1 }] }, facts)).toEqual({ ready: false, text: "zz: Not a deck-legal card." });
  });
});

describe("deck lines", () => {
  it("counts heroes and cards against fifty", () => {
    expect(deckCountLine({ heroes: ["h1"], cards: [{ code: "a0", count: 3 }] })).toBe("1 hero · 3 of 50 cards");
    expect(deckCountLine({ heroes: ["h1", "h2"], cards: allies })).toBe("2 heroes · 51 cards");
    expect(deckContentsPhrase({ heroes: ["h1"], cards: [{ code: "a0", count: 1 }] })).toBe("1 hero and 1 card");
  });

  it("adds the heroes' threat, and has none while a hero's threat is unknown", () => {
    const threats = new Map([["h1", { threat: 9 }], ["h2", { threat: 10 }]]);
    expect(startingThreat(["h1", "h2"], threats)).toBe(19);
    expect(startingThreat(["h1", "h3"], threats)).toBeNull();
    expect(startingThreat([], threats)).toBeNull();
  });
});

describe("deckSections", () => {
  it("groups the cards by type under a heading with its count, each group by name", () => {
    const rows = deckSections([
      { code: "e1", count: 2, name: "Test of Will", typeCode: "event" },
      { code: "a2", count: 1, name: "Gandalf", typeCode: "ally" },
      { code: "a1", count: 3, name: "Faramir", typeCode: "ally" },
      { code: "t1", count: 1, name: "Steward of Gondor", typeCode: "attachment" },
      { code: "x1", count: 1, name: "x1", typeCode: null },
    ]);
    expect(rows.map((row) => (row.kind === "type" ? `${row.title} · ${row.count}` : row.kind === "card" ? row.card.name : "empty"))).toEqual([
      "Allies · 4",
      "Faramir",
      "Gandalf",
      "Attachments · 1",
      "Steward of Gondor",
      "Events · 2",
      "Test of Will",
      "Other cards · 1",
      "x1",
    ]);
  });

  it("always heads allies, attachments and events, with an empty row for a type the deck lacks", () => {
    const rows = deckSections([{ code: "e1", count: 2, name: "Test of Will", typeCode: "event" }]);
    expect(rows.map((row) => (row.kind === "card" ? row.card.name : `${row.kind} ${row.title}`))).toEqual([
      "type Allies",
      "empty Allies",
      "type Attachments",
      "empty Attachments",
      "type Events",
      "Test of Will",
    ]);
  });
});

describe("deck names", () => {
  it("numbers a new deck's name and a copy's name when it is taken", () => {
    expect(newDeckName([])).toBe("New deck");
    expect(newDeckName(["New deck", "new deck 2"])).toBe("New deck 3");
    expect(copyDeckName("Hobbits", ["Hobbits"])).toBe("Hobbits copy");
    expect(copyDeckName("Hobbits", ["Hobbits", "Hobbits copy"])).toBe("Hobbits copy 2");
  });

  it("saves an empty name as a New deck name", () => {
    expect(savedDeckName("  Hobbits ", [])).toBe("Hobbits");
    expect(savedDeckName("  ", ["New deck"])).toBe("New deck 2");
  });
});

describe("deck curve and spheres", () => {
  const faces = new Map([
    ["a", { cost: "0", sphereCode: "lore", sphereName: "Lore" }],
    ["b", { cost: "2", sphereCode: "tactics", sphereName: "Tactics" }],
    ["c", { cost: "6", sphereCode: "lore", sphereName: "Lore" }],
    ["d", { cost: "X", sphereCode: "neutral", sphereName: "Neutral" }],
  ]);

  it("counts copies at each cost, folds 5 and over, and leaves X off the curve", () => {
    const curve = costCurve(
      [
        { code: "a", count: 3 },
        { code: "b", count: 2 },
        { code: "c", count: 1 },
        { code: "d", count: 2 },
      ],
      faces,
    );
    expect(curve.counts).toEqual([3, 0, 2, 0, 0, 1]);
    expect(curve.average).toBe(1.7);
    expect(costCurve([], faces).average).toBeNull();
  });

  it("splits the cards by sphere, largest first", () => {
    expect(
      sphereSplit(
        [
          { code: "a", count: 3 },
          { code: "b", count: 2 },
          { code: "c", count: 1 },
        ],
        faces,
      ).map((entry) => [entry.code, entry.count]),
    ).toEqual([
      ["lore", 4],
      ["tactics", 2],
    ]);
  });
});

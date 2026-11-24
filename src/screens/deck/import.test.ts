import { describe, expect, it } from "vitest";

import {
  buildDecklist,
  cardUrl,
  DROPPED_LOOKUPS_MAX,
  droppedLabel,
  droppedLookups,
  droppedSentence,
  fetchFailureMessage,
  parseDecklistRef,
  prebuiltBody,
  prebuiltDecks,
  prebuiltList,
  prebuiltDetail,
  prebuiltRows,
  deckRefusal,
  readDecklistBody,
  ringsDbUrl,
  type PoolFact,
} from "./import.ts";

const pool = new Map<string, PoolFact>([
  ["141002", { name: "Sam Gamgee", typeCode: "hero", deckLegal: true }],
  ["141003", { name: "Merry", typeCode: "hero", deckLegal: true }],
  ["141004", { name: "Pippin", typeCode: "hero", deckLegal: true }],
  ["01073", { name: "Gandalf", typeCode: "ally", deckLegal: true }],
  ["01026", { name: "Steward of Gondor", typeCode: "attachment", deckLegal: false }],
  ["01014", { name: "Faramir", typeCode: "ally", deckLegal: true }],
  ["9901014", { name: "(MotK) Faramir", typeCode: "hero", deckLegal: false }],
  ["131006", { name: "Bilbo's Ally", typeCode: "ally", deckLegal: true }],
  ["99131006", { name: "(MotK) Bilbo's Ally", typeCode: "hero", deckLegal: false }],
  ["22134", { name: "Messenger of the King", typeCode: "contract", deckLegal: true }],
]);

describe("parseDecklistRef", () => {
  const decklist = (id: string) => ({ kind: "decklist", id });
  const deck = (id: string) => ({ kind: "deck", id });

  it("accepts a decimal id and the two ringsdb.com decklist URLs", () => {
    expect(parseDecklistRef(" 4821 ")).toEqual(decklist("4821"));
    expect(parseDecklistRef("https://ringsdb.com/decklist/view/4821")).toEqual(decklist("4821"));
    expect(parseDecklistRef("https://ringsdb.com/decklist/view/4821/")).toEqual(decklist("4821"));
    expect(parseDecklistRef("https://ringsdb.com/decklist/view/68989/thegoodthebadandtheugly-1.0")).toEqual(decklist("68989"));
    expect(parseDecklistRef("https://ringsdb.com/decklist/view/68989/thegoodthebadandtheugly-1.0/")).toEqual(decklist("68989"));
    expect(parseDecklistRef("https://www.ringsdb.com/api/public/decklist/4821.json")).toEqual(decklist("4821"));
    expect(parseDecklistRef("http://ringsdb.com/api/public/decklist/4821.json?x=1")).toEqual(decklist("4821"));
  });

  it("accepts the ringsdb.com deck URLs", () => {
    expect(parseDecklistRef("https://ringsdb.com/deck/view/4821")).toEqual(deck("4821"));
    expect(parseDecklistRef("https://ringsdb.com/deck/view/4821/")).toEqual(deck("4821"));
    expect(parseDecklistRef("https://www.ringsdb.com/deck/view/4821/road-to-rivendell")).toEqual(deck("4821"));
    expect(parseDecklistRef("https://ringsdb.com/api/public/deck/4821.json")).toEqual(deck("4821"));
    expect(parseDecklistRef("https://ringsdb.com/api/oauth2/deck/load/4821")).toEqual(deck("4821"));
  });

  it("refuses anything else", () => {
    expect(parseDecklistRef("")).toBeNull();
    expect(parseDecklistRef("12a")).toBeNull();
    expect(parseDecklistRef("https://example.com/decklist/view/4821")).toBeNull();
    expect(parseDecklistRef("https://example.com/deck/view/4821")).toBeNull();
    expect(parseDecklistRef("https://ringsdb.com/deck/edit/4821")).toBeNull();
    expect(parseDecklistRef("https://ringsdb.com/api/public/decklist/4821")).toBeNull();
    expect(parseDecklistRef("https://ringsdb.com/api/public/deck/4821")).toBeNull();
  });
});

describe("ringsDbUrl", () => {
  it("names the public decklist JSON and the deck load URL", () => {
    expect(ringsDbUrl({ kind: "decklist", id: "4821" })).toBe("https://ringsdb.com/api/public/decklist/4821.json");
    expect(ringsDbUrl({ kind: "deck", id: "4821" })).toBe("https://ringsdb.com/api/oauth2/deck/load/4821");
  });
});

describe("deckRefusal", () => {
  // The two refusals ringsdb.com/api/oauth2/deck/load/{id} returns, with status 200.
  it("tells an unshared deck from an unknown id", () => {
    const unshared = {
      success: false,
      error: 'You are not allowed to view this deck. To get access, you can ask the deck owner to enable "Share my decks" on their account.',
    };
    expect(deckRefusal(unshared)).toBe("private");
    expect(deckRefusal({ success: false, error: "Deck not found." })).toBe("missing");
  });

  it("passes a deck through", () => {
    expect(deckRefusal({ id: 705936, name: "Road", heroes: {}, slots: {} })).toBeNull();
    expect(deckRefusal(null)).toBeNull();
  });
});

describe("fetchFailureMessage", () => {
  const deck = { kind: "deck", id: "4821" } as const;
  const decklist = { kind: "decklist", id: "4821" } as const;

  it("names sharing only when RingsDB refuses a deck", () => {
    for (const status of [401, 403, 404]) expect(fetchFailureMessage(deck, { kind: "status", status })).toContain("Share my decks");
    expect(fetchFailureMessage(decklist, { kind: "status", status: 404 })).toBe("RingsDB has no published decklist with that number.");
  });

  it("says no answer or a server error for what is not a refusal", () => {
    expect(fetchFailureMessage(deck, { kind: "no-answer" })).toBe("RingsDB did not respond. Check your connection and try again.");
    expect(fetchFailureMessage(deck, { kind: "status", status: 503 })).toBe("RingsDB could not send that deck (error 503). Try again later.");
  });
});

describe("buildDecklist", () => {
  it("keeps deck-legal heroes and slots, and sideslots as the side deck", () => {
    const body = readDecklistBody({
      name: "Road",
      heroes: { "141002": 1, "141003": 1 },
      slots: { "01073": 3, "141004": 1, "99999": 2 },
      sideslots: { "01073": 3, "141002": 1, "01026": 1, "99999": 1 },
    });
    expect(body?.name).toBe("Road");
    const built = buildDecklist(body!, pool);
    expect(built.heroes).toEqual(["141002", "141003", "141004"]);
    expect(built.cards).toEqual([{ code: "01073", count: 3 }]);
    // A hero is left out of the side deck without a word; a card outside the pool is dropped and named once.
    expect(built.side).toEqual([{ code: "01073", count: 3 }]);
    expect(built.droppedCodes).toEqual(["99999", "01026"]);
    expect(built.heroLimit).toBeNull();
    expect(droppedSentence(["99999"])).toBe("Dropped 99999.");
  });

  it("reads RingsDB's empty sideslots (an array) as no side deck", () => {
    const built = buildDecklist(readDecklistBody({ name: "Bare", heroes: { "141002": 1 }, slots: {}, sideslots: [] })!, pool);
    expect(built.side).toEqual([]);
  });

  it("reads a (MotK) hero as its ally in the deck, for Messenger of the King (22134:A:2)", () => {
    const body = readDecklistBody({ name: "Messenger", heroes: { "141002": 1, "9901014": 1 }, slots: { "141002": 1, "9901014": 1, "22134": 1, "01073": 3 } });
    const built = buildDecklist(body!, pool);
    expect(built.heroes).toEqual(["141002"]);
    expect(built.cards).toEqual([{ code: "01014", count: 1 }, { code: "22134", count: 1 }, { code: "01073", count: 3 }]);
    expect(built.droppedCodes).toEqual([]);
  });

  it("reads a Hobbit saga (MotK) hero, coded 99 and six digits, as its ally", () => {
    const built = buildDecklist(readDecklistBody({ name: "Saga", heroes: { "141002": 1, "99131006": 1 }, slots: { "99131006": 1, "22134": 1 } })!, pool);
    expect(built.heroes).toEqual(["141002"]);
    expect(built.cards).toEqual([{ code: "131006", count: 1 }, { code: "22134", count: 1 }]);
    expect(built.droppedCodes).toEqual([]);
  });

  it("refuses a hero quantity above 1", () => {
    const body = readDecklistBody({
      name: "Doubled",
      heroes: { "141002": 2 },
      slots: { "01073": 1 },
    });
    const built = buildDecklist(body!, pool);
    expect(built.heroes).toEqual(["141002"]);
    expect(built.heroLimit).toEqual({ cardCode: "141002", cardName: "Sam Gamgee" });
  });

  it("drops a code that is not deck-legal", () => {
    const body = readDecklistBody({
      name: "Mixed",
      heroes: { "141002": 1, "141003": 1, "141004": 1 },
      slots: { "01026": 1 },
    });
    expect(buildDecklist(body!, pool).droppedCodes).toEqual(["01026"]);
  });

  // The shape ringsdb.com/api/public/decklist/{id}.json returns: `slots` lists the heroes again (decklist 20000 does).
  it("reads a hero that RingsDB repeats in slots once", () => {
    const body = readDecklistBody({
      name: "RingsDB",
      heroes: { "141002": 1, "141003": 1, "141004": 1 },
      slots: { "141002": 1, "141003": 1, "141004": 1, "01073": 3 },
    });
    const built = buildDecklist(body!, pool);
    expect(built.heroes).toEqual(["141002", "141003", "141004"]);
    expect(built.cards).toEqual([{ code: "01073", count: 3 }]);
    expect(built.heroLimit).toBeNull();
  });

  it("drops a hero the pool does not hold once, though RingsDB repeats it in slots", () => {
    const body = readDecklistBody({
      name: "New pack",
      heroes: { "141002": 1, "999001": 1 },
      slots: { "141002": 1, "999001": 1, "01073": 3 },
    });
    const built = buildDecklist(body!, pool);
    expect(built.heroes).toEqual(["141002"]);
    expect(built.droppedCodes).toEqual(["999001"]);
  });

  it("sums a code that is listed in both heroes and slots", () => {
    const body = readDecklistBody({
      name: "Split",
      heroes: { "01073": 3 },
      slots: { "01073": 1 },
    });
    expect(buildDecklist(body!, pool).cards).toEqual([{ code: "01073", count: 4 }]);
  });
});

describe("pre-built decks", () => {
  it("reads every deck as a body with its heroes and cards, and no sideboard", () => {
    const rohan = prebuiltDecks().find((deck) => deck.id === "riders-of-rohan");
    expect(rohan).toBeDefined();
    if (!rohan) return;
    const body = prebuiltBody(rohan);
    expect(body.name).toBe("Riders of Rohan");
    expect(Object.keys(body.heroes).sort()).toEqual([...rohan.heroes].sort());
    expect(Object.values(body.slots).reduce((total, count) => total + count, 0)).toBe(50);
    const names: Record<string, string> = { "07001": "Éomer", "17055": "Hirgon", "22027": "Lothíriel" };
    expect(prebuiltDetail(rohan, (code) => names[code] ?? code)).toBe("Éomer, Hirgon, Lothíriel");
  });

  it("lists the four Learn to Play core decks first, then the printed decklists", () => {
    expect(prebuiltDecks().slice(0, 5).map((deck) => deck.id)).toEqual(["core-leadership", "core-tactics", "core-spirit", "core-lore", "dwarves-of-durin"]);
    expect(prebuiltDecks().length).toBe(35);
  });

  it("names the product in the detail only when the group and the name do not", () => {
    const named = (id: string) => prebuiltDetail(prebuiltDecks().find((deck) => deck.id === id)!, () => "H");
    expect(named("dunedain")).toBe("Angmar Awakened · H, H, H");
    expect(named("valor-and-vigilance")).toBe("The Return of the King · H, H, H");
    expect(named("over-hill-1")).toBe("H, H, H");
    expect(named("road-darkens-1")).toBe("H, H, H");
    expect(named("core-lore")).toBe("H, H, H");
    expect(named("the-red-arrow")).toBe("H, H, H");
  });

  it("puts each group's heading before its decks, once", () => {
    const rows = prebuiltRows(prebuiltDecks());
    expect(rows.filter((row) => row.kind === "group").map((row) => (row.kind === "group" ? row.title : ""))).toEqual([
      "Core Set",
      "Starter Decks",
      "Hero Expansions",
      "Saga Expansions",
      "Original Saga Expansions",
      "The Hobbit",
      "Community Deck Lists",
    ]);
    expect(rows.filter((row) => row.kind === "deck")).toHaveLength(35);
  });
});

describe("the lazy pre-built list", () => {
  it("parses the decks once and builds the list once, with a heading's index for each group", () => {
    expect(prebuiltDecks()).toBe(prebuiltDecks());
    const list = prebuiltList();
    expect(prebuiltList()).toBe(list);
    expect(list.rows.length).toBeGreaterThan(prebuiltDecks().length);
    expect(list.sticky.length).toBeGreaterThan(0);
    expect(list.sticky.every((at) => list.rows[at]?.kind === "group")).toBe(true);
  });
});

describe("what an import trusts of RingsDB's answer", () => {
  it("builds a card URL only for a card code", () => {
    expect(cardUrl("01073")).toBe("https://ringsdb.com/api/public/card/01073.json");
    expect(cardUrl("99131006")).toBe("https://ringsdb.com/api/public/card/99131006.json");
    for (const code of ["", "1073", "010730000", "01073/../../decklist/1", "01073?x=1", "0107a", " 01073", "../x"]) expect(cardUrl(code), code).toBeNull();
  });

  it("looks up at most twenty unknown cards, each once, and none whose code is not a card code", () => {
    const codes = Array.from({ length: 30 }, (_, at) => String(90000 + at));
    const lookups = droppedLookups(["../x", "90000", ...codes]);
    expect(lookups.size).toBe(DROPPED_LOOKUPS_MAX);
    expect(lookups.has("../x")).toBe(false);
    expect([...lookups][0]).toBe("90000");
    expect(lookups.has("90029")).toBe(false);
  });

  it("names a dropped card by RingsDB's name or its code, cut short", () => {
    expect(droppedLabel("01073", " Gandalf ")).toBe("Gandalf");
    expect(droppedLabel("01073", "")).toBe("01073");
    expect(droppedLabel("01073", { name: "x" })).toBe("01073");
    expect(droppedLabel("01073", "x".repeat(500))).toHaveLength(80);
  });

  it("holds each count to a deck's range and refuses a list with more entries than any deck", () => {
    const body = readDecklistBody({ name: "n".repeat(900), heroes: { "01001": -4 }, slots: { "01073": 1e9, "01074": 3 } })!;
    expect(body.heroes).toEqual({ "01001": 0 });
    expect(body.slots).toEqual({ "01073": 99, "01074": 3 });
    expect(body.name).toHaveLength(200);
    const huge = Object.fromEntries(Array.from({ length: 501 }, (_, at) => [String(10000 + at), 1]));
    expect(readDecklistBody({ name: "Huge", heroes: {}, slots: huge })).toBeNull();
  });
});

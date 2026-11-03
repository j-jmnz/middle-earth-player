import { describe, expect, it } from "vitest";

import { matchCard, searchIndexOf, searchTerms, type SearchRow } from "./card-search.ts";
import { fold, searchFold } from "./fold.ts";
import { cycleGroups, emptyPoolFilter, filterPool, type PoolCard } from "./pool-filter.ts";

type Row = PoolCard & SearchRow;

function row(overrides: Partial<Row> & Pick<Row, "code" | "name">): Row {
  return {
    typeCode: "ally",
    typeName: "Ally",
    sphereCode: "leadership",
    sphereName: "Leadership",
    packCode: "Core",
    packCodes: ["Core"],
    traits: null,
    cost: "2",
    threat: null,
    isUnique: false,
    text: null,
    errata: null,
    ...overrides,
  };
}

const rows: Row[] = [
  row({ code: "01057", name: "Unexpected Courage", typeCode: "attachment", typeName: "Attachment", sphereCode: "spirit", sphereName: "Spirit", traits: "Condition.", text: "Attach to a hero.\n<b>Action:</b> Exhaust Unexpected Courage to ready attached hero." }),
  row({ code: "01101", name: "Courage Under Fire", typeCode: "event", typeName: "Event", text: "<b>Response:</b> Draw a card." }),
  row({ code: "01102", name: "Strength of Courage", typeCode: "event", typeName: "Event", text: "Gain a [leadership] resource." }),
  row({ code: "02001", name: "Théoden", typeCode: "hero", typeName: "Hero", sphereCode: "leadership", sphereName: "Leadership", traits: "Noble. Rohan. Warrior.", isUnique: true }),
  row({ code: "02002", name: "Éomer", typeCode: "hero", typeName: "Hero", traits: "Noble. Rohan. Warrior.", isUnique: true }),
  row({ code: "02003", name: "Snowmane", typeCode: "ally", typeName: "Ally", traits: "Rohan. Creature.", text: "Rohan Ally: ready." }),
  row({ code: "02005", name: "Brave Heart", typeCode: "event", typeName: "Event", text: "Show courage." }),
  row({ code: "02004", name: "Gandalf's Staff", typeCode: "attachment", typeName: "Attachment", traits: "Item.", text: "Errata printed.", errata: "Gain a [lore] resource." }),
];
const codes = (query: string) => filterPool(rows, query, emptyPoolFilter, cycleGroups([]), new Set()).map((entry) => entry.code);

describe("fold", () => {
  it("keeps the glossary fold and drops markup and punctuation for the search", () => {
    expect(fold("Théoden’s <b>Rohan</b>")).toBe("theoden's <b>rohan</b>");
    expect(searchFold("Théoden’s <b>Rohan</b> [lore] a-b.")).toBe("theoden s rohan lore a b");
  });
});

describe("searchTerms", () => {
  it("splits on whitespace and keeps a quoted phrase whole", () => {
    expect(searchTerms('  Rohan  "ready attached" Hero ')).toEqual(["rohan", "ready attached", "hero"]);
    expect(searchTerms(' - "" ')).toEqual([]);
  });
});

describe("matchCard", () => {
  it("ranks exact name, name prefix, name word, tag, text, then a typo", () => {
    const index = searchIndexOf(rows[0]!);
    expect(matchCard(index, "unexpected courage")).toBe(0);
    expect(matchCard(index, "unexp")).toBe(1);
    expect(matchCard(index, "courage")).toBe(2);
    expect(matchCard(index, "condition")).toBe(3);
    expect(matchCard(index, "exhaust")).toBe(4);
    expect(matchCard(index, "unexpcted")).toBe(5);
    expect(matchCard(index, "unexpected zzz")).toBeNull();
  });

  it("allows a typo only in a word of five letters or more", () => {
    const index = searchIndexOf(rows[5]!);
    expect(matchCard(index, "snowmnae")).toBe(5);
    expect(matchCard(index, "snwo")).toBeNull();
  });

  it("caches the index per row", () => {
    expect(searchIndexOf(rows[0]!)).toBe(searchIndexOf(rows[0]!));
  });
});

describe("filterPool search", () => {
  it("finds an accented name from plain letters", () => {
    expect(codes("theoden")).toEqual(["02001"]);
    expect(codes("eomer")).toEqual(["02002"]);
  });

  it("matches a trait and a type together", () => {
    expect(codes("rohan ally")).toEqual(["02003"]);
  });

  it("finds a card by its text, the errata when there is one, and a sphere in brackets", () => {
    expect(codes("ready attached hero")).toEqual(["01057"]);
    expect(codes("lore resource")).toEqual(["02004"]);
    expect(codes('"ready attached"')).toEqual(["01057"]);
  });

  it("forgives a one-letter slip", () => {
    expect(codes("unexpcted courage")).toEqual(["01057"]);
  });

  it("puts a name match before a text match, keeping the pool order among equals", () => {
    expect(codes("courage")).toEqual(["01101", "01057", "01102", "02005"]);
    expect(codes("gandalfs")).toEqual(["02004"]);
    expect(codes("rohan")).toEqual(["02001", "02002", "02003"]);
  });

  it("leaves the pool unchanged for an empty query", () => {
    expect(codes("")).toEqual(rows.map((entry) => entry.code));
    expect(codes("  ")).toEqual(rows.map((entry) => entry.code));
  });
});

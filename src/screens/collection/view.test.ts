import { describe, expect, it } from "vitest";

import type { CollectionSet } from "../../catalog/collection";
import { collectionRows, collectionTally, entryLine, notOwnedNote, packCardCounts, setCardCounts } from "./view";

const cycle: CollectionSet = { id: "angmar", heading: "Cycles", name: "Angmar Awakened", title: "Angmar Awakened", detail: "Or the Hero Expansion", packs: ["TLR", "WoE"] };
const campaign: CollectionSet = { id: "aace", heading: "Cycles", name: "Angmar Awakened Campaign Expansion", title: "Angmar Awakened Campaign Expansion", detail: null, packs: ["AACE"] };
const core: CollectionSet = { id: "core", heading: "Core Set", name: "Core Set", title: "Core Set (2011)", detail: "2011", packs: ["Core"] };
const scenarios: CollectionSet = { id: "pod", heading: "Other", name: "Print-on-demand scenarios", title: "Print-on-demand scenarios", detail: "Print-on-demand scenario", packs: ["TOF", "THftD"] };
const allies: CollectionSet = { id: "motk", heading: "Other", name: "Messenger of the King Allies", title: "Messenger of the King Allies", detail: null, packs: ["MotKA"] };
const sets = [cycle, campaign, core, scenarios, allies];

const pool = [
  { packCode: "TLR", packCodes: ["TLR", "WoE"] },
  { packCode: "TLR", packCodes: [] },
  { packCode: "Core", packCodes: ["Core", "TLR"] },
  { packCode: "THftD", packCodes: ["THftD"] },
];
const names = new Map([
  ["TLR", "The Lost Realm"],
  ["WoE", "The Wastes of Eriador"],
  ["Core", "Core Set"],
  ["THftD", "The Hunt for the Dreadnaught"],
]);

function entries() {
  return collectionRows(sets, pool, names).flatMap((row) => (row.kind === "set" ? [row.entry] : []));
}

describe("Collection words", () => {
  it("puts each heading before its sets, and lists no set or pack without a deck-legal card", () => {
    const rows = collectionRows(sets, pool, names);
    expect(rows.map((row) => (row.kind === "heading" ? row.title : row.entry.id))).toEqual(["Cycles", "angmar", "Core Set", "core", "Other", "pod"]);
    expect(collectionRows([campaign, allies], pool, names)).toEqual([]);
  });

  it("counts a card once in a set and once in each pack it is printed in", () => {
    const [angmar] = entries();
    expect(angmar?.cards).toBe(3);
    expect(angmar?.packs).toEqual([
      { code: "TLR", name: "The Lost Realm", cards: 3 },
      { code: "WoE", name: "The Wastes of Eriador", cards: 1 },
    ]);
    expect(Object.fromEntries(setCardCounts(pool, sets))).toEqual({ angmar: 3, aace: 0, core: 1, pod: 1, motk: 0 });
    expect(Object.fromEntries(packCardCounts(pool))).toEqual({ TLR: 3, WoE: 1, Core: 1, THftD: 1 });
  });

  it("names a set left with one pack of several after that pack", () => {
    const pod = entries().find((entry) => entry.id === "pod");
    expect(pod?.label).toBe("The Hunt for the Dreadnaught");
    expect(pod?.codes).toEqual(["THftD"]);
    expect(entries().find((entry) => entry.id === "core")?.label).toBe("Core Set");
  });

  it("says what a row holds, or how many packs are owned while only some are", () => {
    const [angmar, coreSet, pod] = entries();
    if (!angmar || !coreSet || !pod) throw new Error("three entries");
    expect(entryLine(angmar, "all", new Set())).toBe("2 packs, or the Hero Expansion · 3 cards");
    expect(entryLine(angmar, "some", new Set(["WoE"]))).toBe("1 of 2 packs · 3 cards");
    expect(entryLine({ ...angmar, detail: null }, "none", new Set(["TLR", "WoE"]))).toBe("2 packs · 3 cards");
    expect(entryLine(coreSet, "all", new Set())).toBe("2011 · 1 card");
    expect(entryLine(pod, "all", new Set())).toBe("Print-on-demand scenario · 1 card");
    expect(entryLine({ ...coreSet, detail: null }, "all", new Set())).toBe("1 card");
  });

  it("tallies the cards owned", () => {
    expect(collectionTally(1048, 1048)).toBe("Everything owned · 1,048 cards");
    expect(collectionTally(642, 1048)).toBe("642 of 1,048 cards");
  });

  it("names the deck's cards outside the collection once each, and counts past five", () => {
    expect(notOwnedNote([])).toBeNull();
    expect(notOwnedNote(["Elven Light", "Elven Light"])).toBe("1 card is not in your collection: Elven Light.");
    expect(notOwnedNote(["Bow of the Galadhrim", "Elven Light", "A Light in the Dark"])).toBe("3 cards are not in your collection: Bow of the Galadhrim, Elven Light and A Light in the Dark.");
    expect(notOwnedNote(["A", "B", "C", "D", "E", "F", "G"])).toBe("7 cards are not in your collection: A, B, C, D, E and 2 more.");
  });
});

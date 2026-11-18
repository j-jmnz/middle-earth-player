import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import collectionJson from "../../data/collection.json";
import { parseRingsDbPacks } from "./boundary";
import {
  claimedPacks,
  collectionHeadings,
  collectionSchema,
  deckPacks,
  ownsCard,
  parseCollection,
  setOwnership,
  switchPacks,
  unownedCodes,
  type CollectionSet,
} from "./collection";

const dataDir = path.join(__dirname, "..", "..", "data");
const sets = collectionSchema.parse(collectionJson);

type DataCard = { code: string; name: string; deckLegal: boolean; printings: { pack: string }[] };

function dataCards(): DataCard[] {
  const dir = path.join(dataDir, "cards");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as DataCard[]);
}

describe("data/collection.json", () => {
  const cards = dataCards();
  const ringsDb = new Set(parseRingsDbPacks(JSON.parse(readFileSync(path.join(dataDir, "raw", "ringsdb", "packs.json"), "utf8")) as unknown).map((pack) => pack.code));
  // The catalog's packs: the ones RingsDB lists that carry a card (scripts/build/catalog.ts).
  const catalogPacks = new Set(cards.flatMap((card) => card.printings.map((printing) => printing.pack)).filter((code) => ringsDb.has(code)));

  it("names each set once", () => {
    expect(new Set(sets.map((set) => set.id)).size).toBe(sets.length);
  });

  // Every catalog pack is under some switch, so a pack that gains a deck-legal card is already filed; the screens list only the
  // packs that hold one (deckPacks).
  it("puts every catalog pack in exactly one set, and no other code", () => {
    const counts = new Map<string, number>();
    for (const code of sets.flatMap((set) => set.packs)) counts.set(code, (counts.get(code) ?? 0) + 1);
    expect([...counts].filter(([, count]) => count > 1)).toEqual([]);
    expect([...counts.keys()].filter((code) => !catalogPacks.has(code))).toEqual([]);
    expect([...catalogPacks].filter((code) => !counts.has(code)).sort()).toEqual([]);
  });

  it("gives every deck-legal card an owner", () => {
    const claimed = claimedPacks(sets);
    const orphans = cards.filter((card) => card.deckLegal && !card.printings.some((printing) => claimed.has(printing.pack)));
    expect(orphans.map((card) => `${card.code} ${card.name}`)).toEqual([]);
  });

  it("keeps a heading's sets next to one another", () => {
    const seen: string[] = [];
    for (const set of sets) if (seen.at(-1) !== set.heading) seen.push(set.heading);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

const angmar: CollectionSet = { id: "a", heading: "Cycles", name: "Angmar Awakened", title: "Angmar Awakened", detail: null, packs: ["TLR", "WoE"] };
const campaign: CollectionSet = { id: "b", heading: "Cycles", name: "Angmar Awakened Campaign Expansion", title: "Angmar Awakened Campaign Expansion", detail: null, packs: ["AACE"] };
const core: CollectionSet = { id: "c", heading: "Core Set", name: "Core Set", title: "Core Set", detail: null, packs: ["Core"] };

describe("collection ownership", () => {
  const claimed = claimedPacks([angmar, campaign, core]);

  it("files sets under their headings in order", () => {
    expect(collectionHeadings([angmar, core, campaign]).map((group) => [group.heading, group.sets.map((set) => set.id)])).toEqual([
      ["Cycles", ["a", "b"]],
      ["Core Set", ["c"]],
    ]);
  });

  it("lists the packs a deck-legal card is printed in", () => {
    expect([...deckPacks([{ packCode: "Core", packCodes: ["Core", "TLR"] }, { packCode: "WoE", packCodes: [] }])].sort()).toEqual(["Core", "TLR", "WoE"]);
  });

  it("reads a set as all, some or none of its packs", () => {
    expect(setOwnership(angmar, new Set())).toBe("all");
    expect(setOwnership(angmar, new Set(["WoE"]))).toBe("some");
    expect(setOwnership(angmar, new Set(["WoE", "TLR"]))).toBe("none");
  });

  it("owns a card through any printing, and ignores packs no set claims", () => {
    expect(ownsCard(["Core", "TLR"], claimed, new Set(["Core"]))).toBe(true);
    expect(ownsCard(["Core"], claimed, new Set(["Core"]))).toBe(false);
    expect(ownsCard(["Core", "TFotR"], claimed, new Set(["Core"]))).toBe(false);
  });

  it("lists the cards outside the collection, and none while nothing is off", () => {
    const rows = [
      { code: "1", packCode: "Core", packCodes: ["Core"] },
      { code: "2", packCode: "TLR", packCodes: ["TLR", "Core"] },
      { code: "3", packCode: "AACE", packCodes: [] },
    ];
    expect([...unownedCodes(rows, claimed, new Set())]).toEqual([]);
    expect([...unownedCodes(rows, claimed, new Set(["Core", "AACE"]))]).toEqual(["1", "3"]);
  });

  it("switches packs on and off, sorted", () => {
    expect(switchPacks([], ["WoE", "TLR"], false)).toEqual(["TLR", "WoE"]);
    expect(switchPacks(["TLR", "WoE", "Core"], ["TLR", "WoE"], true)).toEqual(["Core"]);
  });

  it("reads a bad saved row as everything owned", () => {
    expect(parseCollection(null)).toEqual([]);
    expect(parseCollection({ notOwned: "Core" })).toEqual([]);
    expect(parseCollection({ notOwned: ["TLR", "Core", "TLR"] })).toEqual(["Core", "TLR"]);
  });
});

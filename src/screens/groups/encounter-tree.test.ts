// The Encounter cards view's list: products in the collection's order with their sets, then their campaigns' sections, and the search over them.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { collectionSets } from "../collection/sets.ts";
import { groupDataOf } from "./cache.ts";
import { campaignTree } from "./campaign-tree.ts";
import { encounterList, productTitle, searchEncounter, type EncounterProduct } from "./encounter-tree.ts";
import { row } from "./fixtures.ts";
import { scenarioTree } from "./scenario-tree.ts";

const collection = [
  { id: "core", title: "Core Set", packs: ["Core"] },
  { id: "cycle", title: "A Cycle", packs: ["P1", "P2"] },
  { id: "campaign-box", title: "A Campaign Expansion", packs: ["CE"] },
];
const cycles = collection.map((entry) => ({ ...entry, heading: "Cycles" }));
const packs = [
  { code: "Core", name: "Core Set" },
  { code: "P1", name: "First Pack" },
  { code: "P2", name: "Second Pack" },
  { code: "CE", name: "A Campaign Expansion" },
];
const rows = [
  row({ code: "1", name: "Spider", typeCode: "enemy", packCode: "Core", encounterSet: "Spiders of Mirkwood" }),
  row({ code: "2", name: "Orc", typeCode: "enemy", packCode: "Core", encounterSet: "Dol Guldur Orcs" }),
  row({ code: "3", name: "Gollum", typeCode: "objective", packCode: "P1", packCodes: ["P1"], encounterSet: "The Hunt" }),
  row({ code: "4", name: "Marsh", typeCode: "location", packCode: "P2", packCodes: ["P2"], encounterSet: "Dead Marshes" }),
  row({ code: "5", name: "Fog", typeCode: "treachery", packCode: "P2", packCodes: ["P2"], encounterSet: "Fog of Númenor" }),
  row({ code: "6", name: "Start", typeCode: "campaign", packCode: "CE", campaignId: "the-campaign" }),
  row({ code: "7", name: "Gift", typeCode: "attachment", packCode: "CE", campaignKind: "boon", campaignId: "the-campaign" }),
];
const campaigns = [{ id: "the-campaign", name: "The Campaign", kind: "campaign" as const, position: 1 }];

function list(): EncounterProduct[] {
  return encounterList(scenarioTree(rows, collection, packs), campaignTree(rows, campaigns, collection, packs, new Map()), collection);
}

function words(products: readonly EncounterProduct[]): string[][] {
  return products.map((product) => [product.title, product.summary, ...product.items.map((item) => (item.kind === "heading" ? `# ${item.title}` : item.label))]);
}

describe("encounterList", () => {
  it("lists each product's sets, a heading over a pack's several sets, then the campaign it prints", () => {
    expect(words(list())).toEqual([
      ["Core Set", "2 sets", "Spiders of Mirkwood", "Dol Guldur Orcs"],
      ["A Cycle", "3 sets", "The Hunt", "# Second Pack", "Dead Marshes", "Fog of Númenor"],
      ["A Campaign Expansion", "Campaign", "# The Campaign", "Campaign cards", "Boons"],
    ]);
  });

  it("says a one-set pack's name beside its count when the set is named otherwise", () => {
    const hunt = list()[1]!.items.find((item) => item.kind === "row" && item.label === "The Hunt");
    expect(hunt).toMatchObject({ group: "set", detail: "First Pack · 1 card" });
  });

  it("titles a cycle of several packs with the word Cycle, and keeps a one-pack product's title", () => {
    expect(cycles.map(productTitle)).toEqual(["Core Set", "A Cycle Cycle", "A Campaign Expansion"]);
    const products = encounterList(scenarioTree(rows, cycles, packs), campaignTree(rows, campaigns, cycles, packs, new Map()), cycles);
    expect(products.map((product) => product.title)).toEqual(["Core Set", "A Cycle Cycle", "A Campaign Expansion"]);
  });
});

describe("searchEncounter", () => {
  it("keeps everything for an empty search, and a whole product its title matches", () => {
    expect(searchEncounter(list(), "  ")).toEqual(list());
    expect(words(searchEncounter(list(), "cycle"))).toEqual([words(list())[1]]);
  });

  it("keeps the rows that match, under their heading, accents and case ignored", () => {
    expect(words(searchEncounter(list(), "numenor"))).toEqual([["A Cycle", "3 sets", "# Second Pack", "Fog of Númenor"]]);
    expect(words(searchEncounter(list(), "first"))).toEqual([["A Cycle", "3 sets", "The Hunt"]]);
    expect(words(searchEncounter(list(), "boons"))).toEqual([["A Campaign Expansion", "Campaign", "# The Campaign", "Boons"]]);
    expect(searchEncounter(list(), "nothing at all")).toEqual([]);
  });
});

describe("the catalog's Encounter cards list", () => {
  const data = groupDataOf(drizzle(new Database(temporaryCatalog(), { readonly: true })));
  const products = encounterList(data.scenario(), data.campaign(), collectionSets());

  it("lists every set and every campaign section once, the Nightmare decks last", () => {
    const keys = products.flatMap((product) => product.items.flatMap((item) => (item.kind === "row" ? [`${item.group}:${item.key}`] : [])));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => key.startsWith("set:")).length).toBe(data.scenario().byKey.size);
    expect(keys.filter((key) => key.startsWith("campaign:")).length).toBe(data.campaign().byKey.size);
    expect(products.at(-1)?.id).toBe("nightmare");
  });

  it("lists every cycle of the collection with its sets, titled as a cycle", () => {
    const cycles = collectionSets().filter((entry) => entry.heading === "Cycles" && entry.packs.length > 1);
    for (const cycle of cycles) {
      const product = products.find((item) => item.id === cycle.id);
      expect(product?.title, cycle.id).toBe(`${cycle.title} Cycle`);
      expect(product?.items.some((item) => item.kind === "row" && item.group === "set"), cycle.id).toBe(true);
    }
    expect(products.find((item) => item.id === "the-hobbit")?.items.some((item) => item.kind === "row" && item.group === "set")).toBe(true);
  });

  it("files a campaign under the product that prints its cards", () => {
    const headings = (id: string) => products.find((product) => product.id === id)?.items.flatMap((item) => (item.kind === "heading" ? [item.title] : []));
    expect(headings("the-lord-of-the-rings")).toEqual(expect.arrayContaining(["Fellowship of the Ring", "The Two Towers", "The Return of the King"]));
    expect(headings("revised-core")).toContain("Mirkwood Paths");
  });
});

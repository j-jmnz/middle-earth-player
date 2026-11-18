// The group data over the real catalog: every card that is not a deck-legal player card is listed exactly where a view says, once per database handle.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { groupDataOf, scenarioFacts } from "./cache.ts";
import { cardGroupOf, MOTK_GROUP_ID } from "./card-group.ts";
import { MOTK_NOTE } from "./motk.ts";
import { isCampaignRow } from "./campaign-tree.ts";
import { isScenarioRow } from "./scenario-tree.ts";

describe("the group cache", () => {
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const data = groupDataOf(catalog);

  it("reads once per catalog handle and holds no deck-legal card", () => {
    expect(groupDataOf(catalog)).toBe(data);
    expect(data.scenario()).toBe(data.scenario());
    expect(data.rows.length).toBeGreaterThan(1500);
    expect(data.rows.some((row) => row.typeCode === "hero" && row.packCode !== "MotKA")).toBe(false);
  });

  it("lists every card in exactly one view", () => {
    const scenario = new Set(data.scenario().products.flatMap((product) => product.packs.flatMap((pack) => pack.sets.flatMap((set) => set.groups.flatMap((group) => group.cards.map((card) => card.code))))));
    const campaign = new Set([...data.campaign().byKey.values()].flatMap(({ section }) => section.groups.flatMap((group) => group.cards.map((card) => card.code))));
    const motk = new Set(data.motk().map((hero) => hero.card.code));
    const lost = data.rows.filter((row) => !scenario.has(row.code) && !campaign.has(row.code) && !motk.has(row.code)).map((row) => `${row.code} ${row.name}`);
    expect(lost).toEqual([]);
    for (const row of data.rows) {
      const where = [scenario.has(row.code), campaign.has(row.code), motk.has(row.code)].filter(Boolean).length;
      expect(where, `${row.code} ${row.name}`).toBe(1);
      expect(isScenarioRow(row) !== isCampaignRow(row) || row.packCode === "MotKA").toBe(true);
    }
  });

  it("ties each of the 84 heroes to the ally it stands for", () => {
    const heroes = data.motk();
    expect(heroes).toHaveLength(84);
    for (const hero of heroes) expect(hero.card.code).toBe(`99${hero.allyCode}`);
    // Each says it is for browsing, on its strip.
    for (const hero of heroes) expect(hero.card.note).toBe(MOTK_NOTE);
  });

  it("resolves a set, a campaign section and the heroes by the route's kind and id", () => {
    const trees = data.trees();
    const set = [...trees.scenario.byKey.keys()][0]!;
    expect(cardGroupOf(trees, "set", set)?.spoiler).toBe(true);
    const section = [...trees.campaign.byKey.keys()][0]!;
    expect(cardGroupOf(trees, "campaign", section)?.groups.length).toBeGreaterThan(0);
    expect(cardGroupOf(trees, "motk", MOTK_GROUP_ID)).toMatchObject({ spoiler: false, title: "Messenger of the King heroes" });
    expect(cardGroupOf(trees, "set", "nowhere~Nothing")).toBeNull();
    expect(cardGroupOf(trees, "motk", "other")).toBeNull();
  });

  it("names the scenario that gives Turayn", () => {
    expect(scenarioFacts().givenBy.get("12166")).toBe("Journey Up the Anduin");
    const section = data.campaign().byKey.get("ered-mithrin~boons")!.section;
    expect(section.groups.flatMap((group) => group.cards).find((card) => card.code === "12166")?.note).toBe("From Journey Up the Anduin");
  });

  it("shows Easy copies from the scenario files, only where Easy Mode keeps fewer", () => {
    const cards = new Map([...data.scenario().byKey.values()].flatMap(({ set }) => set.groups.flatMap((group) => group.cards)).map((card) => [card.code, card]));
    // Forest Spider (4 copies, all kept), Dol Guldur Beastmaster (2, one kept), Hummerhorns (1, none kept) in Passage Through Mirkwood.
    expect(cards.get("01096")).toMatchObject({ copies: 4, easy: null });
    expect(cards.get("01091")).toMatchObject({ copies: 2, easy: 1 });
    expect(cards.get("01075")).toMatchObject({ copies: 1, easy: 0 });
    // A quest card is no copy to remove.
    expect(cards.get("01119")?.easy).toBeNull();
  });
});

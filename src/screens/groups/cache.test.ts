// The group data over the real catalog: every card that is not a deck-legal player card is listed exactly where a view says, once per database handle.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { groupDataOf, givenByScenario } from "./cache.ts";
import { cardGroupOf, MOTK_GROUP_ID } from "./card-group.ts";
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
    expect(givenByScenario().get("12166")).toBe("Journey Up the Anduin");
    const section = data.campaign().byKey.get("ered-mithrin~boons")!.section;
    expect(section.groups.flatMap((group) => group.cards).find((card) => card.code === "12166")?.note).toBe("From Journey Up the Anduin");
  });

  it("keeps Easy copies on the Core set's encounter cards", () => {
    const wilderlands = [...data.scenario().byKey.values()].find(({ set }) => set.name === "Wilderlands")!;
    const easy = wilderlands.set.groups.flatMap((group) => group.cards).filter((card) => card.easy != null);
    expect(easy.length).toBeGreaterThan(0);
  });
});

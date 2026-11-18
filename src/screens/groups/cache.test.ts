// The group data over the real catalog: every card that is not a deck-legal player card is listed exactly where a view says, once per database handle.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { groupDataOf, scenarioFacts } from "./cache.ts";
import { cardGroupOf } from "./card-group.ts";
import { isCampaignRow } from "./campaign-tree.ts";
import type { TypeGroup } from "./group-types.ts";
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

  it("counts each group's cards once: a group's count is its cards and no card repeats in a section or a set", () => {
    const trees = { scenario: data.scenario(), campaign: data.campaign() };
    type Listed = { id: string; groups: readonly TypeGroup[]; count: number };
    const lists: Listed[] = [
      ...[...trees.scenario.byKey.values()].map(({ set }): Listed => ({ id: set.key, groups: set.groups.filter((group) => group.id !== "quest" && group.id !== "nightmare"), count: set.count })),
      ...[...trees.campaign.byKey.values()].map(({ section }): Listed => ({ id: section.key, groups: section.groups, count: section.count })),
    ];
    for (const list of lists) {
      const codes = list.groups.flatMap((group) => group.cards.map((card) => card.code));
      expect(new Set(codes).size, list.id).toBe(codes.length);
      expect(new Set(list.groups.map((group) => group.id)).size, list.id).toBe(list.groups.length);
      expect(list.count, list.id).toBe(list.groups.reduce((sum, group) => sum + group.cards.reduce((inner, card) => inner + card.copies, 0), 0));
    }
  });

  it("files every Nightmare card under its deck's set, so no card is a one-card set named for itself", () => {
    const decks = data.scenario().products.find((product) => product.id === "nightmare")!.packs.flatMap((pack) => pack.sets);
    expect(decks.length).toBeGreaterThan(60);
    for (const set of decks) {
      const typesOf = set.groups.flatMap((group) => group.cards.map((card) => card.typeCode));
      expect(typesOf.filter((type) => type === "nightmare").length, set.name).toBeLessThanOrEqual(1);
    }
    // Only a setup card has no set (its name is the deck's); every other card of a deck is in a set, so none is its own one-card set.
    expect(data.rows.filter((row) => row.packCode === "Nightmare" && row.encounterSet == null && row.typeCode !== "nightmare")).toEqual([]);
    // The side quests of Intruders in Chetwood Nightmare sit with its setup card.
    const chetwood = decks.find((set) => set.name === "Intruders in Chetwood Nightmare")!;
    expect(chetwood.groups.flatMap((group) => group.cards.map((card) => card.code))).toEqual(expect.arrayContaining(["903701", "903709", "903710"]));
  });

  it("ties each of the 84 heroes to the ally it stands for", () => {
    const heroes = data.motk();
    expect(heroes).toHaveLength(84);
    for (const hero of heroes) expect(hero.card.code).toBe(`99${hero.allyCode}`);
    // Each strip names its ally's pack, so two heroes of one name differ ("(MotK) Anborn", 9906114 and 99144004).
    for (const hero of heroes) expect(hero.card.note, hero.card.code).toMatch(/^Ally · .+/);
    const anborn = heroes.filter((hero) => hero.card.name === "(MotK) Anborn").map((hero) => hero.card.note);
    expect(anborn).toHaveLength(2);
    expect(new Set(anborn).size).toBe(2);
  });

  it("resolves a set and a campaign section by the route's kind and id", () => {
    const trees = { scenario: data.scenario(), campaign: data.campaign() };
    const set = [...trees.scenario.byKey.keys()][0]!;
    expect(cardGroupOf(data, "set", set)?.spoiler).toBe(true);
    const section = [...trees.campaign.byKey.keys()][0]!;
    expect(cardGroupOf(data, "campaign", section)?.groups.length).toBeGreaterThan(0);
    expect(cardGroupOf(data, "set", "nowhere~Nothing")).toBeNull();
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

// A briefing's Encounter sets row opens the set the scenario's own cards belong to (docs/design-system.md, Briefing).
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { printedSetName } from "../../campaign/printed-name.ts";
import { campaignIds, campaignOf, scenarioOf } from "../data/campaign-data.ts";
import { groupDataOf } from "./cache.ts";
import { dealtCodes, setKeyFor } from "./scenario-sets.ts";
import type { ScenarioTree } from "./scenario-tree.ts";

const card = (code: string) => ({ code, name: code, typeCode: "enemy", imagesrc: null, copies: 1, easy: null, landscape: false });
const node = (pack: string, name: string, codes: string[]) => ({ key: `${pack}~${name}`, name, count: codes.length, groups: [{ id: "enemy", title: "Enemies", cards: codes.map(card) }] });
function tree(...sets: ReturnType<typeof node>[]): ScenarioTree {
  const byKey = new Map(sets.map((set) => [set.key, { product: { id: "p", title: "P", packs: [] }, pack: { code: set.key.split("~")[0]!, name: "", sets: [] }, set }]));
  return { products: [], byKey };
}

describe("setKeyFor", () => {
  it("picks the set of the name that holds the scenario's cards, not the first match", () => {
    const sets = tree(node("A", "Wilderlands", ["1", "2"]), node("B", "Wilderlands", ["3", "4"]));
    expect(setKeyFor(sets, "Wilderlands", new Set(["3", "4"]))).toBe("B~Wilderlands");
    expect(setKeyFor(sets, "Wilderlands", new Set(["1"]))).toBe("A~Wilderlands");
    expect(setKeyFor(sets, "Wilderlands", new Set())).toBe("A~Wilderlands");
    expect(setKeyFor(sets, "Nowhere", new Set(["1"]))).toBeNull();
  });

  it("reads the stages and the Nightmare cards as the scenario's own", () => {
    expect([...dealtCodes({ cards: [{ code: "a" }], stages: ["q"], nightmare: { cards: [{ code: "n" }], questCards: ["nq"] } })].sort()).toEqual(["a", "n", "nq", "q"]);
  });
});

describe("every scenario's Encounter sets", () => {
  const data = groupDataOf(drizzle(new Database(temporaryCatalog(), { readonly: true })));
  it("resolve to a set that holds at least one card the scenario deals", () => {
    const scenarioTree = data.scenario();
    const missing: string[] = [];
    for (const id of campaignIds()) {
      for (const scenarioId of campaignOf(id)?.scenarios ?? []) {
        const scenario = scenarioOf(scenarioId);
        if (!scenario) continue;
        const codes = dealtCodes(scenario);
        // The briefing names a numbered packet by its printed set (printedSetName).
        const listed = new Set(scenario.encounterSets.map((set) => set.name));
        for (const name of new Set(scenario.encounterSets.map((set) => printedSetName(set.name, listed)))) {
          const key = setKeyFor(scenarioTree, name, codes);
          const held = key ? scenarioTree.byKey.get(key)!.set.groups.some((group) => group.cards.some((c) => codes.has(c.code))) : false;
          if (!held) missing.push(`${scenarioId}: ${name} -> ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("a Fellowship event kit's set", () => {
  const data = groupDataOf(drizzle(new Database(temporaryCatalog(), { readonly: true })));
  it.each(["The Wizard's Quest", "The Woodland Realm", "The Mines of Moria", "Escape from Khazad-dûm"])("lists %s as one set that holds its numbered packets", (name) => {
    const sets = [...data.scenario().byKey.values()].map((found) => found.set).filter((set) => set.name.startsWith(name));
    expect(sets.map((set) => set.name)).toEqual([name]);
    expect(sets[0]!.count).toBeGreaterThan(40);
  });
});

import { describe, expect, it } from "vitest";

import { row } from "./fixtures";
import { isScenarioRow, scenarioTree } from "./scenario-tree";

const collection = [
  { id: "core", title: "Core Set", packs: ["Core"] },
  { id: "cycle", title: "A Cycle", packs: ["P1", "P2", "Empty"] },
];
const packs = [
  { code: "Core", name: "Core Set" },
  { code: "P1", name: "First Pack" },
  { code: "P2", name: "Second Pack" },
  { code: "Empty", name: "No Encounter Pack" },
];

describe("scenarioTree", () => {
  const rows = [
    row({ code: "1", name: "Stage 1", typeCode: "quest", packCode: "P1", encounterSet: "Wilderlands" }),
    row({ code: "2", name: "Wolf", typeCode: "enemy", packCode: "P1", encounterSet: "Wilderlands", quantity: 3, easyQuantity: 1 }),
    row({ code: "3", name: "Hill", typeCode: "location", packCode: "P1", encounterSet: "Wilderlands", quantity: 2 }),
    row({ code: "20", name: "Bat", typeCode: "enemy", packCode: "P1", encounterSet: "Cave Dwellers", quantity: 1 }),
    row({ code: "30", name: "Rat", typeCode: "enemy", packCode: "P2", encounterSet: "Wilderlands", quantity: 2 }),
    row({ code: "40", name: "Gollum", typeCode: "enemy", packCode: "P1", packCodes: ["P1", "P2"], encounterSet: "Shared" }),
    // Not the Scenario view's: a burden, a campaign card, a boon, a player card.
    row({ code: "50", name: "Debt", typeCode: "treachery", packCode: "P1", encounterSet: "Wilderlands", campaignKind: "burden" }),
    row({ code: "51", name: "Setup", typeCode: "campaign", packCode: "P1" }),
    row({ code: "52", name: "Ally", typeCode: "ally", packCode: "P1", campaignKind: "boon" }),
    row({ code: "900101", name: "Wolf Nightmare", typeCode: "nightmare", packCode: "Nightmare", packCodes: [] }),
    row({ code: "900102", name: "Nasty Wolf", typeCode: "enemy", packCode: "Nightmare", packCodes: [], encounterSet: "Wolf Nightmare", quantity: 2 }),
  ];
  const tree = scenarioTree(rows, collection, packs);

  it("lists the collection's products in order, each pack with an encounter card, and the Nightmare decks last", () => {
    expect(tree.products.map((product) => product.id)).toEqual(["cycle", "nightmare"]);
    const cycle = tree.products[0]!;
    expect(cycle.packs.map((pack) => pack.name)).toEqual(["First Pack", "Second Pack"]);
  });

  it("orders a pack's sets by their first card and counts the encounter deck's copies", () => {
    const first = tree.products[0]!.packs[0]!;
    expect(first.sets.map((set) => [set.name, set.count])).toEqual([
      ["Wilderlands", 5],
      ["Cave Dwellers", 1],
      ["Shared", 1],
    ]);
    expect(first.sets[0]!.key).toBe("P1~Wilderlands");
  });

  it("groups a set's cards by type, quest cards first, with Easy copies where they differ", () => {
    const set = tree.byKey.get("P1~Wilderlands")!.set;
    expect(set.groups.map((group) => group.title)).toEqual(["Quest cards", "Enemies", "Locations"]);
    expect(set.groups[1]!.cards[0]).toMatchObject({ code: "2", copies: 3, easy: 1 });
  });

  it("lists a card printed in two packs under both, and a set of the same name apart in each", () => {
    expect(tree.byKey.get("P2~Shared")?.set.count).toBe(1);
    expect(tree.byKey.get("P2~Wilderlands")?.set.count).toBe(2);
  });

  it("gives a Nightmare deck one set with its setup card", () => {
    const deck = tree.byKey.get("Nightmare~Wolf Nightmare")!.set;
    expect(deck.groups.map((group) => group.title)).toEqual(["Enemies", "Nightmare setup"]);
    expect(deck.count).toBe(2);
  });

  it("leaves out what the Campaign view holds", () => {
    expect(rows.filter(isScenarioRow).map((one) => one.code)).not.toContain("50");
    expect(rows.filter(isScenarioRow).map((one) => one.code)).not.toContain("51");
    expect(rows.filter(isScenarioRow).map((one) => one.code)).not.toContain("52");
  });
});

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
    row({ code: "2", name: "Wolf", typeCode: "enemy", packCode: "P1", encounterSet: "Wilderlands", quantity: 3 }),
    row({ code: "3", name: "Hill", typeCode: "location", packCode: "P1", encounterSet: "Wilderlands", quantity: 2 }),
    row({ code: "20", name: "Bat", typeCode: "enemy", packCode: "P1", encounterSet: "Cave Dwellers", quantity: 1 }),
    row({ code: "30", name: "Rat", typeCode: "enemy", packCode: "P2", encounterSet: "Wilderlands", quantity: 2 }),
    row({ code: "40", name: "Gollum", typeCode: "enemy", packCode: "P1", packCodes: ["P1", "P2"], encounterSet: "Shared" }),
    // Not a set's: a burden, a campaign card, a boon, a player card.
    row({ code: "50", name: "Debt", typeCode: "treachery", packCode: "P1", encounterSet: "Wilderlands", campaignKind: "burden" }),
    row({ code: "51", name: "Setup", typeCode: "campaign", packCode: "P1" }),
    row({ code: "52", name: "Ally", typeCode: "ally", packCode: "P1", campaignKind: "boon" }),
    row({ code: "900101", name: "Wolf Nightmare", typeCode: "nightmare", packCode: "Nightmare", packCodes: [] }),
    row({ code: "900102", name: "Nasty Wolf", typeCode: "enemy", packCode: "Nightmare", packCodes: [], encounterSet: "Wolf Nightmare", quantity: 2 }),
  ];
  const tree = scenarioTree(rows, collection, packs, new Map([["2", { normal: 3, easy: 1 }]]));

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

  it("leaves out what the campaign sections hold", () => {
    expect(rows.filter(isScenarioRow).map((one) => one.code)).not.toContain("50");
    expect(rows.filter(isScenarioRow).map((one) => one.code)).not.toContain("51");
    expect(rows.filter(isScenarioRow).map((one) => one.code)).not.toContain("52");
  });
});

// Hall of Beorn puts a few Nightmare cards in an encounter set of their own (Crumbling Stairs of Shadow and Flame, the Stormcaller's cards of The Thing in the Depths): each lies in its deck's row, by its code.
describe("scenarioTree, the Nightmare decks", () => {
  const nightmare = (code: string, name: string, typeCode: string, encounterSet: string | null) => row({ code, name, typeCode, packCode: "Nightmare", packCodes: [], encounterSet });
  const rows = [
    nightmare("901801", "Shadow and Flame Nightmare", "nightmare", null),
    nightmare("901809", "Fiery Depths", "location", "Shadow and Flame Nightmare"),
    nightmare("901810", "Crumbling Stairs", "location", "Shadow and Flame"),
    nightmare("905001", "The Thing in the Depths Nightmare", "nightmare", null),
    nightmare("905002", "Captain's Quarters", "location", "The Stormcaller Nightmare"),
    nightmare("905005", "Corsair Duelist", "enemy", "Corsair Raiders Nightmare"),
    nightmare("905006", "Slithering Arm", "enemy", "The Thing in the Depths Nightmare"),
  ];
  const tree = scenarioTree(rows, [], [{ code: "Nightmare", name: "Nightmare" }]);
  const decks = tree.products[0]?.packs[0]?.sets ?? [];

  it("makes one row of each deck, named for its setup card", () => {
    expect(decks.map((deck) => deck.name)).toEqual(["Shadow and Flame Nightmare", "The Thing in the Depths Nightmare"]);
    expect(decks.map((deck) => deck.key)).toEqual(["Nightmare~Shadow and Flame Nightmare", "Nightmare~The Thing in the Depths Nightmare"]);
  });

  it("keeps a card of another encounter set in its deck's row", () => {
    const cards = (name: string) => tree.byKey.get(`Nightmare~${name}`)?.set.groups.flatMap((group) => group.cards.map((card) => card.code));
    expect(cards("Shadow and Flame Nightmare")).toContain("901810");
    expect(cards("The Thing in the Depths Nightmare")).toEqual(expect.arrayContaining(["905002", "905005", "905006"]));
    expect(tree.byKey.has("Nightmare~Shadow and Flame")).toBe(false);
    expect(tree.byKey.has("Nightmare~Corsair Raiders Nightmare")).toBe(false);
  });
});

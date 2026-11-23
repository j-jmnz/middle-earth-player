// Rules: dcce.ship-objectives, dcce.ship-enemies, dcce.prepare-your-fleet, dcce.corsair-deck (data/rules/entries.json). The Hunt for the Dreadnaught has no rulesheet in data/rules; its rules are the mode cards', the quest
// cards' and the box rulebook's (docs/scenarios/standalone-scenarios/the-hunt-for-the-dreadnaught.md, The Hunt for the Dreadnaught).
// The Hunt for the Dreadnaught, the fourteenth and last scenario of the Standalone scenarios cycle (its own file: standalone-scenarios.test.ts is at the file-size limit): its codes, its piles, its mode cards, the
// stats of its ships and the printed-text ledger read from the scans.
import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadAnyScenario } from "./load-scenarios.ts";
import { keyOf, loadLedger } from "./printed/ledger.ts";

const byCode = new Map(loadCards().map((card) => [card.code, card]));
const hunt = loadAnyScenario("the-hunt-for-the-dreadnaught");
const pile = (name: string) => hunt.cards.filter((card) => card.pile === name);
const copies = (name: string) => pile(name).reduce((sum, card) => sum + card.normal, 0);

describe("The Hunt for the Dreadnaught", () => {
  it("keeps RingsDB's codes 40001 to 40047, deals Standard Mode as its mode card and two quest stages, and excludes the other two mode cards", () => {
    expect(hunt).toMatchObject({ id: "the-hunt-for-the-dreadnaught", name: "The Hunt for the Dreadnaught", stages: ["40004", "40005"], modeCard: "40002", easyModeCard: "40001" });
    expect(hunt.campaignCard).toBeUndefined();
    expect(hunt.source).toMatchObject({ dragnNormal: "Q99.15", dragnEasy: "Q99.15" });
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "THftD"));
    expect(own.map((card) => card.code)).toEqual(Array.from({ length: 47 }, (_, at) => `400${String(at + 1).padStart(2, "0")}`));
    expect(["40001", "40002", "40003"].map((code) => byCode.get(code)?.type)).toEqual(["campaign", "campaign", "campaign"]);
    expect(hunt.cards.map((card) => card.code)).not.toContain("40001");
    expect(hunt.cards.map((card) => card.code)).not.toContain("40002");
    expect(hunt.cards.map((card) => card.code)).not.toContain("40003");
  });

  it("deals the 43-card encounter deck, the 13-card Corsair deck and, set aside, the six ships, four Gondorian Warships and seven unique enemies, on Normal and Easy alike", () => {
    expect(hunt.encounterSets).toEqual([{ name: "The Hunt for the Dreadnaught", count: 43 }]);
    for (const difficulty of ["Normal", "Easy"] as const) expect(encounterCodes(hunt, difficulty, 1), difficulty).toHaveLength(43);
    expect([copies("encounter"), copies("corsairDeck"), copies("setAside"), copies("quest")]).toEqual([43, 13, 17, 2]);
    const aside = pile("setAside").map((card) => byCode.get(card.code));
    expect(aside.filter((card) => card?.type === "ship-objective").map((card) => card?.name)).toEqual(["Eithiliant", "Golden Wing", "Pride of Lebennin", "Silent Mist", "Swan Ship of Dol Amroth", "Twilight's Call", "Gondorian Warship"]);
    expect(aside.filter((card) => card?.isUnique && (card.type === "enemy" || card.type === "ship-enemy"))).toHaveLength(7);
    expect(pile("corsairDeck").every((card) => byCode.get(card.code)?.type === "enemy")).toBe(true);
  });

  it("gives the ships, the Dreadnaught and Sea Monster their printed type and stats, which Hall of Beorn does not list", () => {
    expect(byCode.get("40033")).toMatchObject({ type: "enemy", engagementCost: 26, threat: 2, attack: 4, defense: 0, health: 11 });
    expect(byCode.get("40006")).toMatchObject({ type: "ship-objective", willpower: 5, attack: 3, defense: 3, health: 13, back: { willpower: 6, attack: 4, defense: 4, health: 15 } });
    expect(byCode.get("40011")).toMatchObject({ willpower: 3, attack: 4, defense: 4, health: 18, back: { willpower: 4, attack: 5, defense: 5, health: 22 } });
    expect(byCode.get("40012")).toMatchObject({ willpower: 3, attack: 5, defense: 4, health: 10 });
    expect(byCode.get("40013")).toMatchObject({ type: "ship-enemy", engagementCost: 0, threat: 4, attack: 7, defense: 4, health: null, back: { threat: 3, attack: 5, defense: 3, victory: 99 } });
    expect(byCode.get("40029")).toMatchObject({ type: "ship-enemy", engagementCost: 44, threat: 3, attack: 8, defense: 4, health: 9, victory: 6 });
    expect(byCode.get("40004")?.keywords).toMatchObject({ questPointsX: true });
  });

  it("has every printed side read from its scan, with the places Hall of Beorn's text differs fixed", () => {
    const ledger = loadLedger();
    // The 3 mode cards, 2 quest stages, 6 ships and the Dreadnaught on both sides, the Gondorian Warship and the 31 other encounter cards.
    const read = ledger.entries.filter((entry) => entry.printing === "THftD");
    expect(read).toHaveLength(58);
    for (const entry of read) expect(entry.readBy, `${entry.code}.${entry.side}`).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("40002", "A"))?.lines[3]).toBe("• Set aside all 7 unique enemies (including the Dreadnaught).");
    expect(ledger.byKey.get(keyOf("40002", "B"))?.lines[0]).toMatch(/Reveal the top card of the encounter deck\. \(Group limit once per game\.\)$/);
    expect(ledger.byKey.get(keyOf("40001", "A"))?.lines[3]).toMatch(/2 copies of Black Sails, and 1 copy of Corsair Warship\.$/);
    expect(ledger.byKey.get(keyOf("40010", "B"))?.misprints).toEqual([{ line: 2, printed: "Response: After Swan of Dol Amroth flips, add 2 resources to a hero's resource pool. Ready a card." }]);
    expect(ledger.byKey.get(keyOf("40013", "A"))?.lines[0]).toBe("Archery 1 PerPlayer. Massive. Immune to player card effects. Cannot take more than 5 PerPlayer damage each round.");
    expect(ledger.byKey.get(keyOf("40007", "A"))?.lines[2]).toMatch(/^Setup: Reduce your threat by 3\./);
    expect(ledger.byKey.get(keyOf("40046", "A"))?.lines[0]).toMatch(/assigns X damage among characters they control/);
  });
});

// Rules: none (Escape from Khazad-dûm has no rulesheet; its rules are the quest cards' and the kit's Quick-build rules, docs/brief.md, Escape from Khazad-dûm).
// Escape from Khazad-dûm, the thirteenth scenario of the Standalone scenarios cycle (its own file: standalone-scenarios.test.ts is at the file-size limit): its codes, its piles and the printed-text
// ledger read from the scans.
import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadAnyScenario } from "./load-scenarios.ts";
import { keyOf, loadLedger } from "./printed/ledger.ts";

const byCode = new Map(loadCards().map((card) => [card.code, card]));
const khazad = loadAnyScenario("escape-from-khazad-dum");

describe("Escape from Khazad-dûm", () => {
  it("has codes 513 and the collector number, which Hall of Beorn's 00001 to 00053 would share with earlier packs (overrides.productCodes), the seven quest cards as stages and Dark Pit with Durin's Bane as its back", () => {
    expect(khazad).toMatchObject({ id: "escape-from-khazad-dum", name: "Escape from Khazad-dûm", stages: ["51301", "51303", "51304", "51305", "51307", "51308", "51309"] });
    expect(khazad.campaignCard).toBeUndefined();
    expect(khazad.campaignPlaced).toEqual([]);
    expect(khazad.source).toMatchObject({ dragnNormal: "Q99.14", dragnEasy: "Q99.14" });
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "EfKD"));
    expect(own.map((card) => card.code)).toEqual(["51301", "51303", "51304", "51305", "51307", "51308", "51309", ...Array.from({ length: 44 }, (_, at) => `513${String(at + 10)}`)]);
    expect(khazad.cards.find((card) => card.code === "51310")).toMatchObject({ pile: "staging", back: "51311" });
  });

  it("deals the 14 encounter sets of the kit, 5 cards each, on Normal and Easy alike, and gives every encounter card its printed cost", () => {
    expect(khazad.encounterSets).toHaveLength(15);
    expect(khazad.encounterSets.slice(1).every((set) => set.count === 5)).toBe(true);
    for (const difficulty of ["Normal", "Easy"] as const) expect(encounterCodes(khazad, difficulty, 1), difficulty).toHaveLength(70);
    for (let number = 12; number <= 53; number += 1) expect(byCode.get(`513${number}`)?.cost, `513${number}`).not.toBeNull();
    expect([byCode.get("51312")?.cost, byCode.get("51313")?.cost, byCode.get("51336")?.cost, byCode.get("51353")?.cost]).toEqual(["0", "2", "3", "1"]);
    expect(byCode.get("51316")).toMatchObject({ threat: null, questPoints: 4 });
  });

  it("has every printed side read from its scan, with the places Hall of Beorn's text differs fixed", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("513")).flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(58);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("51301", "A"))?.lines[0]).toMatch(/^Setup: Add Dark Pit to the staging area\. The opposing team searches the encounter deck for one different 0-cost enemy or location per player/);
    expect(ledger.byKey.get(keyOf("51303", "A"))?.lines[0]).toMatch(/Its 'when revealed' effects cannot be canceled\.$/);
    expect(ledger.byKey.get(keyOf("51305", "B"))?.lines[1]).toBe("During the travel phase, the players must travel to a location, if able.");
    expect(ledger.byKey.get(keyOf("51308", "B"))?.lines[1]).toMatch(/more than X damage each round/);
    expect(ledger.byKey.get(keyOf("51336", "A"))?.lines[1]).toMatch(/against the first player\.'$/);
    expect(ledger.byKey.get(keyOf("51340", "A"))?.lines[0]).toMatch(/places it faceup under Goblin Dungeon as a guarded objective/);
    expect(ledger.byKey.get(keyOf("51352", "A"))?.lines[0]).toMatch(/^While Mithril Lode is the active location/);
  });
});

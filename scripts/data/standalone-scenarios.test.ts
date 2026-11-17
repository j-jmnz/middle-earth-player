// Rules: none (The Massing at Osgiliath has no rulesheet; its rules are the quest card's).
// The Standalone scenarios cycle as built so far, The Massing at Osgiliath: its codes, its scenario file, the piles the load list and the printed Setup leave, the
// ledger read from the scans, and the one thing that makes it a cycle: no campaign card, prelude or booklet.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encounterCodes, setupInstructions } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadAnyScenario, loadCampaign } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { keyOf, loadLedger } from "./printed/ledger.ts";

const byCode = new Map(loadCards().map((card) => [card.code, card]));
const cycle = loadCampaign("standalone-scenarios");
const scenario = loadAnyScenario("the-massing-at-osgiliath");
const SCOUTS = ["00002", "00003", "00004"];

describe("The Standalone scenarios cycle", () => {
  it("is a cycle with no campaign card, prelude, booklet or starter deck, listing the scenarios built so far", () => {
    expect(cycle.scenarios).toEqual(["the-massing-at-osgiliath"]);
    // The scenarios not built yet are the file's `later` (Hall of Beorn's titles under the cycle's later products, release order; the Coming later rows of the Scenarios tab).
    expect(cycle.later).toEqual(["The Battle of Lake-town", "The Stone of Erech", "The Old Forest", "Fog on the Barrow-downs", "The Ruins of Belegost", "Murder at the Prancing Pony", "The Siege of Annúminas", "Attack on Dol Guldur", "The Wizard's Quest", "The Woodland Realm", "The Mines of Moria", "Escape from Khazad-dûm", "The Hunt for the Dreadnaught"]);
    expect(cycle).toMatchObject({ kind: "cycle", saga: false, campaignCards: {}, prelude: [], starterDecks: [] });
    expect(cycle.bookletId).toBeUndefined();
    const raw = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "standalone-scenarios.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(raw)).not.toContain("campaignCards");
    const index = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "index.json"), "utf8")) as { id: string; scenarioCount: number; playable: boolean; box: string | null }[];
    expect(index.filter((entry) => entry.id === "standalone-scenarios")).toEqual([expect.objectContaining({ scenarioCount: 1, playable: true, box: null })]);
  });
});

describe("The Massing at Osgiliath", () => {
  it("is built from Hall of Beorn's cards 00001 to 00019, DragnCards' deck Q99.01 and no campaign card", () => {
    expect(scenario).toMatchObject({ id: "the-massing-at-osgiliath", name: "The Massing at Osgiliath", number: 1, stages: ["00016", "00017", "00018", "00019"] });
    expect(scenario.campaignCard).toBeUndefined();
    expect(scenario.campaignPlaced).toEqual([]);
    expect(scenario.source.dragnNormal).toBe("Q99.01");
    expect(scenario.nightmare).toBeUndefined();
    expect(scenario.encounterSets).toEqual([{ name: "The Massing at Osgiliath", count: 28 }]);
    for (const code of ["00001", "00016", "00019"]) expect(byCode.get(code)?.printings[0]?.pack).toBe("TMaO");
  });

  it("deals the 40 encounter cards (plus the Witch-king) on Normal and Easy, the Scouts staged one of each title per player and the Witch-king set aside (00016:A:1)", () => {
    expect(encounterCodes(scenario, "Normal", 1)).toHaveLength(37);
    expect(encounterCodes(scenario, "Easy", 1)).toHaveLength(37);
    for (const seats of [1, 2, 3, 4]) {
      const staged = setupInstructions(scenario, "Normal", seats).filter((step) => step.verb === "AddToStaging").map((step) => step.code);
      expect(staged.sort(), `${seats} seats`).toEqual(SCOUTS.flatMap((code) => Array.from({ length: seats }, () => code)).sort());
      expect(encounterCodes(scenario, "Normal", seats)).toHaveLength(40 - 3 * seats);
    }
    expect(setupInstructions(scenario).filter((step) => step.verb === "SetAside")).toEqual([{ verb: "SetAside", code: "00001" }]);
    for (const code of SCOUTS) expect(scenario.cards.find((card) => card.code === code)).toMatchObject({ pile: "staging", normal: 4, easy: 4, perPlayer: 1 });
  });

  it("prints the Witch-king's trait as Nazgûl (Hall of Beorn garbles it)", () => {
    expect(byCode.get("00001")?.traits).toEqual(["Nazgûl", "Captain"]);
    for (const card of byCode.values()) if (card.code.startsWith("000")) expect(card.traits.join(), card.code).not.toMatch(/[√≤]/);
  });

  it("has every printed side read from its scan", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("000") && card.encounterSet === "The Massing at Osgiliath").flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(23);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
  });
});

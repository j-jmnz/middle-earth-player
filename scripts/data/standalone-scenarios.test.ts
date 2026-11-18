// Rules: none (The Massing at Osgiliath, The Battle of Lake-town and The Stone of Erech have no rulesheet; their rules are the quest cards').
// The Standalone scenarios cycle as built so far, The Massing at Osgiliath, The Battle of Lake-town and The Stone of Erech: their codes, its scenario file, the piles the load list and the printed Setup leave, the
// ledger read from the scans, and the one thing that makes it a cycle: no campaign card, prelude or booklet.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { dealtPiles, encounterCodes, setupInstructions } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadAnyScenario, loadCampaign } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { keyOf, loadLedger } from "./printed/ledger.ts";

const byCode = new Map(loadCards().map((card) => [card.code, card]));
const cycle = loadCampaign("standalone-scenarios");
const scenario = loadAnyScenario("the-massing-at-osgiliath");
const lakeTown = loadAnyScenario("the-battle-of-lake-town");
const stone = loadAnyScenario("the-stone-of-erech");
const SCOUTS = ["00002", "00003", "00004"];

describe("The Standalone scenarios cycle", () => {
  it("is a cycle with no campaign card, prelude, booklet or starter deck, listing the scenarios built so far", () => {
    expect(cycle.scenarios).toEqual(["the-massing-at-osgiliath", "the-battle-of-lake-town", "the-stone-of-erech"]);
    // The scenarios not built yet are the file's `later` (Hall of Beorn's titles under the cycle's later products, release order; the Coming later rows of the Scenarios tab).
    expect(cycle.later).toEqual(["The Old Forest", "Fog on the Barrow-downs", "The Ruins of Belegost", "Murder at the Prancing Pony", "The Siege of Annúminas", "Attack on Dol Guldur", "The Wizard's Quest", "The Woodland Realm", "The Mines of Moria", "Escape from Khazad-dûm", "The Hunt for the Dreadnaught"]);
    expect(cycle).toMatchObject({ kind: "cycle", saga: false, campaignCards: {}, prelude: [], starterDecks: [] });
    expect(cycle.bookletId).toBeUndefined();
    const raw = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "standalone-scenarios.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(raw)).not.toContain("campaignCards");
    const index = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "index.json"), "utf8")) as { id: string; scenarioCount: number; playable: boolean; box: string | null }[];
    expect(index.filter((entry) => entry.id === "standalone-scenarios")).toEqual([expect.objectContaining({ scenarioCount: 3, playable: true, box: null })]);
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

describe("The Battle of Lake-town", () => {
  it("has codes 502 and the collector number, which Hall of Beorn's 00001 to 00024 would share with The Massing at Osgiliath's (overrides.productCodes)", () => {
    expect(lakeTown).toMatchObject({ id: "the-battle-of-lake-town", name: "The Battle of Lake-town", number: 2, stages: ["50201", "50202", "50203"] });
    expect(lakeTown.campaignCard).toBeUndefined();
    expect(lakeTown.campaignPlaced).toEqual([]);
    expect(lakeTown.source.dragnNormal).toBe("Q99.02");
    expect(lakeTown.nightmare).toBeUndefined();
    expect(lakeTown.encounterSets).toEqual([{ name: "The Battle of Lake-town", count: 45 }]);
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "TBoLT"));
    expect(own.map((card) => card.code)).toEqual(Array.from({ length: 24 }, (_, at) => `502${String(at + 1).padStart(2, "0")}`));
    expect(byCode.get("00004")?.printings[0]?.pack).toBe("TMaO");
    expect(byCode.get("50204")?.name).toBe("Smaug the Mighty");
  });

  it("deals the same 36 encounter cards on Normal and Easy, Lake-town staged and the nine Smaug cards dealt into the Smaug deck (50201:A:1)", () => {
    for (const seats of [1, 2, 3, 4]) {
      expect(encounterCodes(lakeTown, "Normal", seats), `${seats} seats`).toHaveLength(36);
      expect(encounterCodes(lakeTown, "Easy", seats), `${seats} seats`).toHaveLength(36);
    }
    expect(setupInstructions(lakeTown).filter((step) => step.verb === "AddToStaging")).toEqual([{ verb: "AddToStaging", code: "50207" }]);
    expect(setupInstructions(lakeTown).filter((step) => step.verb === "SetAside")).toEqual([]);
    // The Smaug deck is a pile of its own, with a discard pile (src/rules/core/piles.ts DECKS), in both difficulties.
    for (const difficulty of ["Normal", "Easy"] as const) expect([...(dealtPiles(lakeTown, difficulty).smaugDeck ?? [])].sort(), difficulty).toEqual(["50204", "50204", "50204", "50205", "50205", "50205", "50206", "50206", "50206"]);
  });

  it("has every printed side in the ledger, its lines the scan's wording", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("502")).flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(27);
    for (const key of sides) expect(ledger.byKey.has(key), key).toBe(true);
    expect(ledger.byKey.get(keyOf("50201", "A"))?.lines[0]).toMatch(/^Setup: Shuffle all copies of Smaug into a separate Smaug deck\./);
    expect(ledger.byKey.get(keyOf("50204", "A"))?.lines[1]).toMatch(/a shadow card for each attack/);
  });
});

describe("The Stone of Erech", () => {
  it("has codes 503 and the collector number, which Hall of Beorn's 00001 to 00027 would share with the earlier standalone packs' (overrides.productCodes)", () => {
    expect(stone).toMatchObject({ id: "the-stone-of-erech", name: "The Stone of Erech", number: 3, stages: ["50301", "50302", "50303"] });
    expect(stone.campaignCard).toBeUndefined();
    expect(stone.campaignPlaced).toEqual([]);
    expect(stone.source.dragnNormal).toBe("Q99.03");
    expect(stone.nightmare).toBeUndefined();
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "TSoE"));
    expect(own.map((card) => card.code)).toEqual(Array.from({ length: 27 }, (_, at) => `503${String(at + 1).padStart(2, "0")}`));
    expect(byCode.get("50307")?.name).toBe("Tarlang's Neck");
  });

  it("deals the same encounter deck on Normal and Easy, Tarlang's Neck the active location and Derufin, the Lord of the Dead, the Stone and the three Night objectives set aside (50301:A:1)", () => {
    for (const seats of [1, 2, 3, 4]) {
      expect(encounterCodes(stone, "Normal", seats), `${seats} seats`).toHaveLength(38);
      expect(encounterCodes(stone, "Easy", seats), `${seats} seats`).toHaveLength(38);
    }
    for (const difficulty of ["Normal", "Easy"] as const) {
      expect(setupInstructions(stone, difficulty).filter((step) => step.verb === "SetAside").map((step) => step.code).sort(), difficulty).toEqual(["50304", "50305", "50306", "50308", "50309", "50310"]);
      expect(setupInstructions(stone, difficulty).filter((step) => step.verb === "MakeActiveLocation").map((step) => step.code), difficulty).toEqual(["50307"]);
    }
  });

  it("has every printed side read from its scan, Tarlang's Neck as printed (Hall of Beorn has \"Next\")", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("503")).flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(30);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("50301", "A"))?.lines[0]).toMatch(/^Setup: Make Tarlang's Neck the active location\./);
  });
});

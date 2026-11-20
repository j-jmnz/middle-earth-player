// Rules: none (The Massing at Osgiliath, The Battle of Lake-town and The Stone of Erech have no rulesheet; their rules are the quest cards').
// The Standalone scenarios cycle as built so far, The Massing at Osgiliath, The Battle of Lake-town, The Stone of Erech, The Old Forest, Fog on the Barrow-downs, The Ruins of Belegost, Murder at the Prancing Pony, The Siege of Annúminas, Attack on Dol Guldur, The Wizard's Quest, The Woodland Realm and The Mines of Moria: their codes, its scenario file, the piles the load list and the printed Setup leave, the
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
const forest = loadAnyScenario("the-old-forest");
const fog = loadAnyScenario("fog-on-the-barrow-downs");
const ruins = loadAnyScenario("the-ruins-of-belegost");
const murder = loadAnyScenario("murder-at-the-prancing-pony");
const siege = loadAnyScenario("the-siege-of-annuminas");
const guldur = loadAnyScenario("attack-on-dol-guldur");
const wizard = loadAnyScenario("the-wizards-quest");
const woodland = loadAnyScenario("the-woodland-realm");
const moria = loadAnyScenario("the-mines-of-moria");
const SCOUTS = ["00002", "00003", "00004"];

describe("The Standalone scenarios cycle", () => {
  it("is a cycle with no campaign card, prelude, booklet or starter deck, listing the scenarios built so far", () => {
    expect(cycle.scenarios).toEqual(["the-massing-at-osgiliath", "the-battle-of-lake-town", "the-stone-of-erech", "the-old-forest", "fog-on-the-barrow-downs", "the-ruins-of-belegost", "murder-at-the-prancing-pony", "the-siege-of-annuminas", "attack-on-dol-guldur", "the-wizards-quest", "the-woodland-realm", "the-mines-of-moria"]);
    // The scenarios not built yet are the file's `later` (Hall of Beorn's titles under the cycle's later products, release order; the Coming later rows of the Scenarios tab).
    expect(cycle.later).toEqual(["Escape from Khazad-dûm", "The Hunt for the Dreadnaught"]);
    expect(cycle).toMatchObject({ kind: "cycle", saga: false, campaignCards: {}, prelude: [], starterDecks: [] });
    expect(cycle.bookletId).toBeUndefined();
    const raw = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "standalone-scenarios.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(raw)).not.toContain("campaignCards");
    const index = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "index.json"), "utf8")) as { id: string; scenarioCount: number; playable: boolean; box: string | null }[];
    expect(index.filter((entry) => entry.id === "standalone-scenarios")).toEqual([expect.objectContaining({ scenarioCount: 12, playable: true, box: null })]);
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

describe("The Old Forest", () => {
  it("has Hall of Beorn's own codes 147001 to 147024, six stages with Aragorn left a Core Set card and the Wicked Willow named as printed", () => {
    expect(forest).toMatchObject({ id: "the-old-forest", name: "The Old Forest", number: 4, stages: ["147001", "147002", "147003", "147004", "147005", "147006"] });
    expect(forest.campaignCard).toBeUndefined();
    expect(forest.campaignPlaced).toEqual([]);
    expect(forest.source.dragnNormal).toBe("Q99.04");
    expect(forest.nightmare).toBeUndefined();
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "TOF"));
    expect(own.map((card) => card.code)).toEqual(Array.from({ length: 24 }, (_, at) => `1470${String(at + 1).padStart(2, "0")}`));
    expect(byCode.get("01001")?.printings.some((printing) => printing.pack === "TOF")).toBe(false);
    expect(byCode.get("147006")?.name).toBe("The Wicked Willow");
  });

  it("deals 38 cards (the searched locations among them) on Normal and the 7 fewer Hall of Beorn's Easy counts remove on Easy, Old Man Willow and Withywindle set aside (147001:A:1)", () => {
    for (const seats of [1, 2, 3, 4]) {
      expect(encounterCodes(forest, "Normal", seats), `${seats} seats`).toHaveLength(38);
      expect(encounterCodes(forest, "Easy", seats), `${seats} seats`).toHaveLength(31);
    }
    for (const difficulty of ["Normal", "Easy"] as const) {
      expect(setupInstructions(forest, difficulty).filter((step) => step.verb === "SetAside").map((step) => step.code).sort(), difficulty).toEqual(["147007", "147011"]);
    }
    const dealt = (code: string, difficulty: "Normal" | "Easy") => encounterCodes(forest, difficulty, 1).filter((item) => item === code).length;
    expect([dealt("147018", "Normal"), dealt("147018", "Easy")]).toEqual([3, 1]);
    expect([dealt("147008", "Normal"), dealt("147008", "Easy")]).toEqual([4, 2]);
    expect([dealt("147019", "Normal"), dealt("147019", "Easy")]).toEqual([2, 1]);
  });

  it("has every printed side read from its scan, the stage 2B's end of the planning phase as printed (Hall of Beorn has \"beginning\")", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("147") && card.code <= "147022").flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(28);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("147002", "B"))?.lines[0]).toBe("Forced: At the end of the planning phase, each player must exhaust a hero he controls.");
  });
});

describe("Fog on the Barrow-downs", () => {
  it("has Hall of Beorn's own codes 148001 to 148021 (RingsDB's pack FotBd), four stages with Tom Bombadil a card of its own beside The Old Forest's 147022", () => {
    expect(fog).toMatchObject({ id: "fog-on-the-barrow-downs", name: "Fog on the Barrow-downs", number: 5, stages: ["148001", "148002", "148003", "148004"] });
    expect(fog.campaignCard).toBeUndefined();
    expect(fog.campaignPlaced).toEqual([]);
    expect(fog.source.dragnNormal).toBe("Q99.05");
    expect(fog.nightmare).toBeUndefined();
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "FotBd"));
    expect(own.map((card) => card.code)).toEqual(["148001", "148002", "148003", "148004", "148005", "148006", "148007", "148008", "148009", "148010", "148011", "148012", "148013", "148014", "148015", "148016", "148017", "148018", "148019", "148020", "148021"]);
    expect(byCode.get("01001")?.printings.some((printing) => printing.pack === "FotBd")).toBe(false);
    expect(byCode.get("148019")?.text).toBe(byCode.get("147022")?.text);
  });

  it("deals the 34 cards of the encounter deck on Normal and the 7 fewer (and 2 fewer Great Barrows set aside) Hall of Beorn's Easy counts remove on Easy, the Hollow Circle, the Standing Stones and the Great Barrows set aside (148001:A:1)", () => {
    for (const seats of [1, 2, 3, 4]) {
      expect(encounterCodes(fog, "Normal", seats), `${seats} seats`).toHaveLength(34);
      expect(encounterCodes(fog, "Easy", seats), `${seats} seats`).toHaveLength(27);
    }
    const aside = (difficulty: "Normal" | "Easy") => setupInstructions(fog, difficulty).filter((step) => step.verb === "SetAside").map((step) => step.code);
    expect(aside("Normal").sort()).toEqual(["148005", "148006", "148007", "148007", "148007", "148007", "148007"]);
    expect(aside("Easy").sort()).toEqual(["148005", "148006", "148007", "148007", "148007"]);
    const dealt = (code: string, difficulty: "Normal" | "Easy") => encounterCodes(fog, difficulty, 1).filter((item) => item === code).length;
    expect([dealt("148014", "Normal"), dealt("148014", "Easy")]).toEqual([2, 0]);
    expect([dealt("148008", "Normal"), dealt("148008", "Easy")]).toEqual([3, 2]);
    expect([dealt("148011", "Normal"), dealt("148011", "Easy")]).toEqual([4, 3]);
  });

  it("has every printed side read from its scan, the campaign card and boon inert, the Great Barrow lines as printed (Hall of Beorn has typos)", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("148") && card.code <= "148019").flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(23);
    for (const key of [...sides, keyOf("148020", "A"), keyOf("148020", "B"), keyOf("148021", "A")]) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("148007", "A"))?.lines[0]).toBe("Peril. Immune to player card effects. The players cannot travel here.");
    expect(ledger.byKey.get(keyOf("148013", "A"))?.lines[0]).toBe("While Dark-wight is engaged with a player, that player's heroes cannot gain resources from card effects.");
  });
});

describe("The Ruins of Belegost", () => {
  it("has codes 506 and the collector number, which Hall of Beorn's 00001 to 00030 would share with The Massing at Osgiliath's (overrides.productCodes), and its own Easy deck", () => {
    expect(ruins).toMatchObject({ id: "the-ruins-of-belegost", name: "The Ruins of Belegost", number: 6, stages: ["50601", "50602", "50603", "50604", "50605", "50606", "50607"] });
    expect(ruins.campaignCard).toBeUndefined();
    expect(ruins.campaignPlaced).toEqual([]);
    expect(ruins.source).toMatchObject({ dragnNormal: "Q99.06", dragnEasy: "E99.06" });
    expect(ruins.nightmare).toBeUndefined();
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "TRoB"));
    expect(own.map((card) => card.code)).toEqual(Array.from({ length: 30 }, (_, at) => `506${String(at + 1).padStart(2, "0")}`));
    expect(byCode.get("01004")?.printings.some((printing) => printing.pack === "TRoB")).toBe(false);
    expect(byCode.get("50615")?.name).toBe("Naurlhûg");
  });

  it("deals the 31 titles of the encounter deck plus the Abandoned Mines the players do not stage (4 less 1 for each player) on Normal and the 6 fewer Hall of Beorn's Easy counts remove on Easy, the nine set-aside cards (Lurker, Naurlhûg, its Lair, the Sword and the five other Loot objectives) set aside (50601:A:1)", () => {
    for (const seats of [1, 2, 3, 4]) {
      expect(encounterCodes(ruins, "Normal", seats), `${seats} seats`).toHaveLength(35 - seats);
      expect(encounterCodes(ruins, "Easy", seats), `${seats} seats`).toHaveLength(29 - seats);
    }
    for (const difficulty of ["Normal", "Easy"] as const) {
      expect(setupInstructions(ruins, difficulty).filter((step) => step.verb === "SetAside").map((step) => step.code).sort(), difficulty).toEqual(["50609", "50610", "50611", "50612", "50613", "50614", "50615", "50616", "50621"]);
    }
    expect(setupInstructions(ruins).filter((step) => step.verb === "AddToStaging").map((step) => ("code" in step ? step.code : "")).filter((code) => code !== "50622")).toEqual(["50608"]);
  });

  it("has every printed side read from its scan, the Setup and the stage lines as printed (Hall of Beorn has typos) and Lurker of the Depths with its three lines", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("506")).flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(37);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("50601", "B"))?.lines[0]).toBe("The players cannot advance unless they control at least 1 Loot objective.");
    expect(ledger.byKey.get(keyOf("50608", "A"))?.lines[0]).toMatch(/place 1 resource on Stalking the Ruins/);
    expect(ledger.byKey.get(keyOf("50616", "A"))?.lines).toHaveLength(3);
    expect(ledger.byKey.get(keyOf("50615", "A"))?.misprints).toHaveLength(1);
  });
});

describe("Murder at the Prancing Pony", () => {
  it("has codes 507 and the collector number, which Hall of Beorn's 00001 to 00029 would share with The Massing at Osgiliath's (overrides.productCodes), and its own Easy deck", () => {
    expect(murder).toMatchObject({ id: "murder-at-the-prancing-pony", name: "Murder at the Prancing Pony", stages: ["50701", "50702", "50703"] });
    expect(murder.campaignCard).toBeUndefined();
    expect(murder.campaignPlaced).toEqual([]);
    expect(murder.source).toMatchObject({ dragnNormal: "Q99.07", dragnEasy: "E99.07" });
    expect(murder.nightmare).toBeUndefined();
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "MatPP"));
    expect(own.map((card) => card.code)).toEqual(Array.from({ length: 29 }, (_, at) => `507${String(at + 1).padStart(2, "0")}`));
    expect(byCode.get("01005")?.printings.some((printing) => printing.pack === "MatPP")).toBe(false);
    expect(byCode.get("50715")?.name).toBe("The Prancing Pony");
    expect(byCode.get("141045")?.name).toBe("The Prancing Pony");
  });

  it("deals the 36 encounter cards of Normal and the 27 of Easy (Hall of Beorn's page: 40 against 50 cards), The Prancing Pony active, 1 Ramshackle Manor staged and the 5 Suspects, 5 Hideouts and Taken by Surprise set aside (50701:A:1)", () => {
    for (const seats of [1, 2, 3, 4]) {
      expect(encounterCodes(murder, "Normal", seats), `${seats} seats`).toHaveLength(36);
      expect(encounterCodes(murder, "Easy", seats), `${seats} seats`).toHaveLength(27);
    }
    const aside = ["50704", "50705", "50706", "50707", "50708", "50709", "50710", "50711", "50712", "50713", "50714"];
    expect(setupInstructions(murder, "Normal").filter((step) => step.verb === "SetAside").map((step) => step.code).sort()).toEqual([...aside, "50714"].sort());
    expect(setupInstructions(murder, "Easy").filter((step) => step.verb === "SetAside").map((step) => step.code).sort()).toEqual(aside);
    expect(setupInstructions(murder).filter((step) => step.verb === "AddToStaging").map((step) => ("code" in step ? step.code : ""))).toEqual(["50716"]);
    expect(murder.cards.find((card) => card.pile === "activeLocation")).toMatchObject({ code: "50715", normal: 1, easy: 1 });
    expect(murder.cards.find((card) => card.code === "50717")).toMatchObject({ normal: 3, easy: 1 });
  });

  it("has every printed side read from its scan, the Setup and the Hideout and Suspect lines as printed (Hall of Beorn has typos)", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("507")).flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(32);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("50702", "B"))?.lines[0]).toMatch(/from the Investigation deck/);
    expect(ledger.byKey.get(keyOf("50704", "A"))?.lines[2]).toMatch(/discard pile, and victory display/);
    expect(ledger.byKey.get(keyOf("50726", "A"))?.lines[1]).toMatch(/attached and return that enemy/);
    expect(ledger.byKey.get(keyOf("50722", "A"))?.lines[0]).toMatch(/Bree-land Informant makes an attack/);
  });
});

describe("The Siege of Annúminas", () => {
  it("has codes 508 and the collector number, which Hall of Beorn's 00001 to 00032 would share with The Massing at Osgiliath's (overrides.productCodes), the two mode cards and Standard Game Mode's stages 1A to 3A", () => {
    expect(siege).toMatchObject({ id: "the-siege-of-annuminas", name: "The Siege of Annúminas", stages: ["50803", "50804", "50805"] });
    expect(siege.campaignCard).toBeUndefined();
    expect(siege.campaignPlaced).toEqual([]);
    expect(siege.source).toMatchObject({ dragnNormal: "Q99.08", dragnEasy: "Q99.08" });
    expect(siege.nightmare).toBeUndefined();
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "TSoA"));
    expect(own.map((card) => card.code)).toEqual(Array.from({ length: 32 }, (_, at) => `508${String(at + 1).padStart(2, "0")}`));
    expect(byCode.get("02095")?.printings.some((printing) => printing.pack === "TSoA")).toBe(false);
    expect(byCode.get("50801")).toMatchObject({ name: "Standard Game Mode", type: "campaign" });
    expect(byCode.get("50802")).toMatchObject({ name: "Epic Multiplayer Mode", type: "campaign" });
    expect(byCode.get("50812")?.name).toBe("Annúminas");
  });

  it("deals the 35 encounter cards, Annúminas staged by the mode card's Setup and the Lieutenant, Battering Ram, Enemy Camp, Siege Tunnel, 3 Hosts and 3 Dúnedain set aside (50803:A:1, 50801:A:1), on Normal and Easy alike", () => {
    for (const seats of [1, 2, 3, 4]) {
      expect(encounterCodes(siege, "Normal", seats), `${seats} seats`).toHaveLength(35);
      expect(encounterCodes(siege, "Easy", seats), `${seats} seats`).toHaveLength(35);
    }
    for (const difficulty of ["Normal", "Easy"] as const) {
      expect(setupInstructions(siege, difficulty).filter((step) => step.verb === "SetAside").map((step) => step.code).sort(), difficulty).toEqual(["50813", "50814", "50815", "50816", "50817", "50817", "50817", "50818", "50818", "50818"]);
    }
    expect(siege.cards.find((card) => card.code === "50812")).toMatchObject({ pile: "staging", normal: 1, easy: 1 });
    expect(siege.cards.some((card) => ["50801", "50802", "50806", "50807", "50808", "50809", "50810", "50811"].includes(card.code))).toBe(false);
  });

  it("has every printed side read from its scan, the mode cards and the Epic stages included, with the printed typos kept under misprints", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("508")).flatMap((card) => (card.type === "quest" || card.type === "campaign" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(43);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("50801", "A"))?.lines[0]).toMatch(/Remove the 1C-3C deck and the 1E-3E deck/);
    expect(ledger.byKey.get(keyOf("50801", "A"))?.misprints).toHaveLength(1);
    expect(ledger.byKey.get(keyOf("50801", "B"))?.lines).toHaveLength(2);
    expect(ledger.byKey.get(keyOf("50803", "A"))?.lines[0]).toMatch(/each copy of Host of Angmar, and each copy of Dúnedain of Annúminas aside/);
    expect(ledger.byKey.get(keyOf("50803", "A"))?.misprints[0]?.printed).toMatch(/each copy Dúnedain of Annúminas/);
    expect(ledger.byKey.get(keyOf("50808", "B"))?.lines[0]).toBe("Progress cannot be placed here while Enemy Camp is in play.");
    expect(ledger.byKey.get(keyOf("50831", "A"))?.lines[0]).toMatch(/^When Revealed: Each player must choose/);
  });
});

describe("Attack on Dol Guldur", () => {
  it("has codes 509 and the collector number, which Hall of Beorn's 00001 to 00032 would share with The Massing at Osgiliath's (overrides.productCodes), the two mode cards and the six Standard stages", () => {
    expect(guldur).toMatchObject({ id: "attack-on-dol-guldur", name: "Attack on Dol Guldur", stages: ["50901", "50902", "50903", "50904", "50905", "50906"], modeCard: "50931" });
    expect(guldur.campaignCard).toBeUndefined();
    expect(guldur.campaignPlaced).toEqual([]);
    expect(guldur.source).toMatchObject({ dragnNormal: "Q99.10", dragnEasy: "Q99.10" });
    expect(guldur.nightmare).toBeUndefined();
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "AoDG"));
    expect(own.map((card) => card.code)).toEqual(Array.from({ length: 32 }, (_, at) => `509${String(at + 1).padStart(2, "0")}`));
    expect(byCode.get("50931")).toMatchObject({ name: "Standard Game Mode", type: "campaign" });
    expect(byCode.get("50932")).toMatchObject({ name: "Epic Multiplayer Mode", type: "campaign" });
    expect(byCode.get("50907")?.name).toBe("Dol Guldur");
  });

  it("deals the 36 encounter cards plus the Dol Guldur Marauders the 1A Setup does not stage (4 less 1 for each player) on Normal and Easy alike, Dol Guldur and Power of Lórien staged and the Host of Lórien and the four Lieutenants set aside (50901:A:1, 50931:A:1)", () => {
    for (const seats of [1, 2, 3, 4]) {
      expect(encounterCodes(guldur, "Normal", seats), `${seats} seats`).toHaveLength(36 + 4 - seats);
      expect(encounterCodes(guldur, "Easy", seats), `${seats} seats`).toHaveLength(36 + 4 - seats);
    }
    for (const difficulty of ["Normal", "Easy"] as const) {
      expect(setupInstructions(guldur, difficulty).filter((step) => step.verb === "SetAside").map((step) => step.code).sort(), difficulty).toEqual(["50909", "50910", "50911", "50912", "50913"]);
    }
    expect(guldur.cards.find((card) => card.code === "50907")).toMatchObject({ pile: "staging", normal: 1, easy: 1 });
    expect(guldur.cards.some((card) => ["50931", "50932"].includes(card.code))).toBe(false);
  });

  it("has every printed side read from its scan, the mode cards included, with the four places Hall of Beorn's text differs fixed", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("509")).flatMap((card) => (card.type === "quest" || card.type === "campaign" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(40);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("50913", "A"))?.lines[0]).toBe("Indestructible. Immune to player card effects.");
    expect(ledger.byKey.get(keyOf("50920", "A"))?.lines[0]).toMatch(/The players cannot travel/);
    expect(ledger.byKey.get(keyOf("50906", "B"))?.lines[1]).toMatch(/for an ally and puts it into play/);
    expect(ledger.byKey.get(keyOf("50931", "A"))?.lines[0]).toMatch(/increase its value by 5 for each player/);
    expect(ledger.byKey.get(keyOf("50931", "B"))?.lines).toHaveLength(3);
  });
});

describe("The Wizard's Quest", () => {
  it("has codes 510 and the collector number, which Hall of Beorn's 00001 to 00054 would share with earlier packs (overrides.productCodes), the seven quest cards as stages and the double-sided Rhosgobel", () => {
    expect(wizard).toMatchObject({ id: "the-wizards-quest", name: "The Wizard's Quest", stages: ["51001", "51003", "51004", "51005", "51007", "51008", "51009"] });
    expect(wizard.campaignCard).toBeUndefined();
    expect(wizard.campaignPlaced).toEqual([]);
    expect(wizard.source).toMatchObject({ dragnNormal: "Q99.11", dragnEasy: "Q99.11" });
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "TWQ"));
    expect(own.map((card) => card.code)).toEqual(["51001", "51003", "51004", "51005", "51007", "51008", "51009", ...Array.from({ length: 45 }, (_, at) => `510${String(at + 10)}`)]);
    expect(wizard.cards.find((card) => card.code === "51010")).toMatchObject({ pile: "staging", back: "51011" });
  });

  it("deals the 14 encounter sets of the kit, 5 cards each, on Normal and Easy alike", () => {
    expect(wizard.encounterSets).toHaveLength(15);
    expect(wizard.encounterSets.slice(1).every((set) => set.count === 5)).toBe(true);
    for (const difficulty of ["Normal", "Easy"] as const) expect(encounterCodes(wizard, difficulty, 1), difficulty).toHaveLength(70);
  });

  it("has every printed side read from its scan, with the places Hall of Beorn's text differs fixed", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("510")).flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(59);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("51003", "A"))?.lines[0]).toMatch(/for a card with cost 1 or less .* sets it aside, and shuffles/);
    expect(ledger.byKey.get(keyOf("51009", "A"))?.lines).toHaveLength(1);
    expect(ledger.byKey.get(keyOf("51009", "B"))?.lines).toHaveLength(3);
    expect(ledger.byKey.get(keyOf("51052", "A"))?.lines[1]).toMatch(/if it has the Warg trait/);
  });
});

describe("The Woodland Realm", () => {
  it("has codes 511 and the collector number, which Hall of Beorn's 00001 to 00053 would share with earlier packs (overrides.productCodes), the seven quest cards as stages and the double-sided Spider Den / Mendor", () => {
    expect(woodland).toMatchObject({ id: "the-woodland-realm", name: "The Woodland Realm", stages: ["51101", "51103", "51104", "51105", "51107", "51108", "51109"] });
    expect(woodland.campaignCard).toBeUndefined();
    expect(woodland.campaignPlaced).toEqual([]);
    expect(woodland.source).toMatchObject({ dragnNormal: "Q99.12", dragnEasy: "Q99.12" });
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "TWR"));
    expect(own.map((card) => card.code)).toEqual(["51101", "51103", "51104", "51105", "51107", "51108", "51109", ...Array.from({ length: 44 }, (_, at) => `511${String(at + 10)}`)]);
    expect(woodland.cards.find((card) => card.code === "51110")).toMatchObject({ pile: "staging", back: "51111" });
  });

  it("deals the 14 encounter sets of the kit, 5 cards each, on Normal and Easy alike, and gives every encounter card its printed cost", () => {
    expect(woodland.encounterSets).toHaveLength(15);
    expect(woodland.encounterSets.slice(1).every((set) => set.count === 5)).toBe(true);
    for (const difficulty of ["Normal", "Easy"] as const) expect(encounterCodes(woodland, difficulty, 1), difficulty).toHaveLength(70);
    for (let number = 12; number <= 53; number += 1) expect(byCode.get(`511${number}`)?.cost, `511${number}`).not.toBeNull();
    expect([byCode.get("51112")?.cost, byCode.get("51119")?.cost, byCode.get("51122")?.cost, byCode.get("51153")?.cost]).toEqual(["3", "3", "2", "1"]);
  });

  it("has every printed side read from its scan, with the places Hall of Beorn's text differs fixed", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("511")).flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(58);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("51101", "A"))?.lines[0]).toMatch(/and adds them to the staging area/);
    expect(ledger.byKey.get(keyOf("51103", "A"))?.lines[0]).toMatch(/The opposing team searches .* with cost 1 or less \(cost 2 or less/);
    expect(ledger.byKey.get(keyOf("51110", "A"))?.lines[1]).toMatch(/\(1 cost or less instead if there are two or more players\)/);
    expect(ledger.byKey.get(keyOf("51151", "A"))?.lines[1]).toMatch(/^Shadow: Engage the lowest engagement cost enemy/);
    expect(ledger.byKey.get(keyOf("51122", "A"))?.misprints).toHaveLength(1);
  });
});

describe("The Mines of Moria", () => {
  it("has codes 512 and the collector number, which Hall of Beorn's 00001 to 00053 would share with earlier packs (overrides.productCodes), the seven quest cards as stages and the two-sided The Watcher / Chamber of Mazarbul", () => {
    expect(moria).toMatchObject({ id: "the-mines-of-moria", name: "The Mines of Moria", stages: ["51201", "51203", "51204", "51205", "51207", "51208", "51209"] });
    expect(moria.campaignCard).toBeUndefined();
    expect(moria.campaignPlaced).toEqual([]);
    expect(moria.source).toMatchObject({ dragnNormal: "Q99.13", dragnEasy: "Q99.13" });
    const own = [...byCode.values()].filter((card) => card.printings.some((printing) => printing.pack === "TMoM"));
    expect(own.map((card) => card.code)).toEqual(["51201", "51203", "51204", "51205", "51207", "51208", "51209", ...Array.from({ length: 44 }, (_, at) => `512${String(at + 10)}`)]);
    expect(moria.cards.find((card) => card.code === "51210")).toMatchObject({ pile: "staging", back: "51211" });
  });

  it("deals the 14 encounter sets of the kit, 5 cards each, on Normal and Easy alike, and gives every encounter card its printed cost", () => {
    expect(moria.encounterSets).toHaveLength(15);
    expect(moria.encounterSets.slice(1).every((set) => set.count === 5)).toBe(true);
    for (const difficulty of ["Normal", "Easy"] as const) expect(encounterCodes(moria, difficulty, 1), difficulty).toHaveLength(70);
    for (let number = 12; number <= 53; number += 1) expect(byCode.get(`512${number}`)?.cost, `512${number}`).not.toBeNull();
    expect([byCode.get("51212")?.cost, byCode.get("51219")?.cost, byCode.get("51233")?.cost, byCode.get("51253")?.cost]).toEqual(["2", "2", "3", "1"]);
  });

  it("has every printed side read from its scan, with the places Hall of Beorn's text differs fixed", () => {
    const ledger = loadLedger();
    const sides = [...byCode.values()].filter((card) => card.code.startsWith("512")).flatMap((card) => (card.type === "quest" ? ["A", "B"] : ["A"]).map((side) => keyOf(card.code, side as "A" | "B")));
    expect(sides).toHaveLength(58);
    for (const key of sides) expect(ledger.byKey.get(key)?.readBy, key).toBe("Claude Code, read from the scan image");
    expect(ledger.byKey.get(keyOf("51201", "A"))?.lines[0]).toMatch(/^Setup: Each player adds 1 resource to each of his heroes' resource pools\. Add The Watcher/);
    expect(ledger.byKey.get(keyOf("51214", "A"))?.lines[0]).toMatch(/The opposing team attaches Shadow of Fear/);
    expect(ledger.byKey.get(keyOf("51221", "A"))?.lines[1]).toMatch(/into the encounter deck\.$/);
    expect(ledger.byKey.get(keyOf("51223", "A"))?.lines[0]).toMatch(/Denizen of the Deep gains surge\. \(Counts as a Condition attachment/);
    expect(ledger.byKey.get(keyOf("51242", "A"))?.lines[0]).toMatch(/non-combat damage\.$/);
  });
});

// Rules: mec112.setting-up-the-game, mec112.setup-the-uruk-hai, mec112.setup-helms-deep, mec112.setup-the-road-to-isengard, mec112.setup-the-passage-of-the-marshes,
// mec112.setup-journey-to-the-cross-roads, mec112.setup-shelobs-lair, mec112.gollum-smeagol (data/rules/entries.json). The Two Towers campaign built from The Treason of
// Saruman and The Land of Shadow (RingsDB twins of the MEC112 box): its codes, scenarios, piles and saga start.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { REPRINT_PACKS, REPRINTS } from "./campaign-defs.ts";
import { loadCards } from "./load-cards.ts";
import { loadCampaign, loadScenario, loadScenarioDefinitions } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";

const cards = loadCards();
const byCode = new Map(cards.map((card) => [card.code, card]));
const campaign = loadCampaign("the-two-towers");

// The first 16 hex digits of the sha256 of a record's JSON with its keys sorted.
function digestOf(record: object): string {
  const sorted = JSON.stringify(record, (_key, value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([x], [y]) => (x < y ? -1 : 1))) : value));
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

// The Normal and Easy encounter decks, the cards each scenario sets aside or stages, and the decks beside the encounter deck.
const DECK = {
  "the-uruk-hai": { normal: 34, easy: 25, staging: ["143022", "143023"], setAside: [], active: ["143027"] },
  "helms-deep": { normal: 35, easy: 25, staging: [], setAside: ["143033", "143036", "143038"], active: [] },
  "the-road-to-isengard": { normal: 32, easy: 22, staging: ["143046"], setAside: ["143047", "143048", "143053", "143054"], active: [] },
  "the-passage-of-the-marshes": { normal: 36, easy: 25, staging: [], setAside: ["144075"], active: [] },
  "journey-to-the-cross-roads": { normal: 29, easy: 25, staging: ["144027", "144030"], setAside: [], active: [], harad: 9 },
  "shelobs-lair": { normal: 27, easy: 20, staging: ["144044"], setAside: ["144040", "144045", "144076"], active: ["144043"], spider: 10 },
} as const;

describe("The Two Towers codes", () => {
  const box = cards.filter((card) => card.printings.some((printing) => printing.pack === "TTwT"));

  it("gives each of the 156 MEC112 cards the code of its Treason of Saruman or Land of Shadow twin, and no other card that code", () => {
    expect(box).toHaveLength(156);
    expect(new Set(box.map((card) => card.code)).size).toBe(156);
    const files = new Map<string, string[]>();
    for (const name of readdirSync(path.join(DATA_DIR, "cards")).filter((file) => file.endsWith(".json"))) {
      for (const card of JSON.parse(readFileSync(path.join(DATA_DIR, "cards", name), "utf8")) as { code: string }[]) files.set(card.code, [...(files.get(card.code) ?? []), name]);
    }
    for (const card of box) {
      expect(files.get(card.code), card.code).toEqual([card.printings[0]?.pack === "ToS" ? "ToS.json" : "LoS.json"]);
      expect(card.code, card.name).toMatch(/^14[34]\d{3}$/);
      expect(card.printings.map((printing) => printing.pack), card.code).toEqual(expect.arrayContaining(["TTwT"]));
    }
    expect(box.filter((card) => card.code.startsWith("143"))).toHaveLength(81);
    expect(box.filter((card) => card.code.startsWith("144"))).toHaveLength(75);
  });

  it("pairs a title both saga boxes print with its own box's twin, not the other's (Aragorn, Frodo Baggins, The One Ring, Gollum)", () => {
    expect(byCode.get("143001")).toMatchObject({ name: "Aragorn", sphere: "fellowship" });
    expect(byCode.get("144001")).toMatchObject({ name: "Frodo Baggins", sphere: "fellowship" });
    expect(byCode.get("144063")).toMatchObject({ name: "The One Ring" });
    expect(byCode.get("141085")).toMatchObject({ name: "The One Ring" });
    expect(byCode.get("141085")?.printings.map((printing) => printing.pack)).not.toContain("TTwT");
    expect(byCode.get("144063")?.printings.map((printing) => printing.pack)).not.toContain("TFotR");
    expect(byCode.get("144075")).toMatchObject({ name: "Gollum", type: "enemy" });
    expect(byCode.get("144076")).toMatchObject({ name: "Sméagol", type: "objective" });
  });

  it("keeps the RingsDB record of a Two Towers player card and adds only the MEC112 printing", () => {
    const aragorn = byCode.get("143001");
    expect(aragorn?.printings.map((printing) => printing.pack)).toEqual(["ToS", "TTwT"]);
    // RingsDB's marked-up text, not the ledger's plain words (printed.ts, applyPrinted).
    expect(aragorn?.text).toContain("<b>Action:</b> Spend 2 resources from Aragorn's resource pool to ready a hero.");
    // Every deck-legal ToS and LoS record, fields other than printings, as it was before the TTwT printing (a digest of each, `two-towers-ringsdb.json`).
    const digests: Record<string, string> = JSON.parse(readFileSync(path.join(import.meta.dirname, "two-towers-ringsdb.json"), "utf8"));
    expect(Object.keys(digests)).toHaveLength(27);
    for (const [code, digest] of Object.entries(digests)) {
      const card = byCode.get(code);
      expect(card, code).toBeDefined();
      const { printings, ...rest } = card!;
      const packs = printings.map((printing) => printing.pack);
      expect(packs[0], code).toMatch(/^(ToS|LoS)$/);
      expect(packs.at(-1), code).toBe("TTwT");
      expect(digestOf(rest), code).toBe(digest);
    }
  });

  it("names one reprint set and pack per saga box, the Fellowship's unchanged", () => {
    expect(REPRINTS.map((reprint) => [reprint.set, reprint.pack, reprint.product])).toEqual([
      ["The Fellowship of the Ring", "TFotR", "MEC109"],
      ["The Two Towers", "TTwT", "MEC112"],
    ]);
    expect([...REPRINT_PACKS]).toEqual(["TFotR", "TTwT"]);
  });
});

describe("The Two Towers campaign", () => {
  it("is a saga campaign of six scenarios in play order, each with its campaign card, opening the MEC112 booklet", () => {
    expect(campaign.scenarios).toEqual(Object.keys(DECK));
    expect(campaign.saga).toBe(true);
    expect(campaign.xp).toBeUndefined();
    expect(campaign.bookletId).toBe("the-two-towers");
    expect(campaign.starterDecks).toEqual([]);
    // The saga hero of each scenario is the scenario's `sagaStart`; the campaign's prelude stays empty.
    expect(campaign.prelude).toEqual([]);
    expect(campaign.campaignCards).toEqual({
      "the-uruk-hai": "143071",
      "helms-deep": "143077",
      "the-road-to-isengard": "143081",
      "the-passage-of-the-marshes": "144067",
      "journey-to-the-cross-roads": "144069",
      "shelobs-lair": "144073",
    });
    expect(campaign.bookletPages).toEqual({ "the-uruk-hai": 6, "helms-deep": 7, "the-road-to-isengard": 8, "the-passage-of-the-marshes": 9, "journey-to-the-cross-roads": 9, "shelobs-lair": 10 });
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode, [], "the-two-towers")).not.toThrow();
    for (const [at, id] of campaign.scenarios.entries()) {
      const scenario = loadScenario(id);
      expect(scenario.number, id).toBe(at + 7);
      expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
      expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      expect(byCode.get(scenario.campaignCard)?.name, id).toBe(scenario.name);
      expect(scenario.source.dragnNormal, id).toBe(`Q0C.${String(at + 7).padStart(2, "0")}`);
      expect(scenario.source.dragnEasy, id).toBe(`E0C.${String(at + 7).padStart(2, "0")}`);
      expect(scenario.cards.some((card) => byCode.get(card.code)?.printings.some((printing) => printing.pack === "Nightmare")), `${id} deals no Nightmare card`).toBe(false);
    }
  });

  it.each(Object.entries(DECK))("%s deals the encounter deck, the Setup piles and the second encounter deck the load list and the printed Setup leave", (id, pin) => {
    const scenario = loadScenario(id);
    const copies = (pile: string): number => scenario.cards.filter((card) => card.pile === pile).reduce((sum, card) => sum + card.normal, 0);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
    expect(scenario.cards.filter((card) => card.pile === "activeLocation").map((card) => card.code)).toEqual([...pin.active]);
    expect(copies("haradDeck")).toBe("harad" in pin ? pin.harad : 0);
    expect(copies("greatSpiderDeck")).toBe("spider" in pin ? pin.spider : 0);
  });

  it("deals the printed total of cards of each scenario's encounter sets: the rulebook's lists and Hall of Beorn's rows agree", () => {
    // Each double-sided card once and the burdens of the scenario's own sets (which the campaign deals) counted: 7: 37, 8: 45, 9: 41, 10: 41, 11: 40, 12: 43.
    const TOTAL = { "the-uruk-hai": 37, "helms-deep": 45, "the-road-to-isengard": 41, "the-passage-of-the-marshes": 41, "journey-to-the-cross-roads": 40, "shelobs-lair": 43 } as const;
    for (const [id, total] of Object.entries(TOTAL)) {
      const scenario = loadScenario(id);
      const piles = scenario.cards.filter((card) => card.pile !== "quest").reduce((sum, card) => sum + card.normal, 0);
      const burdens = scenario.campaignPlaced.filter((code) => byCode.get(code)?.campaignKind === "burden").reduce((sum, code) => sum + (byCode.get(code)?.quantity ?? 0), 0);
      expect(piles + burdens, id).toBe(total);
    }
  });

  it("names the encounter sets the booklet's paragraph names, in Hall of Beorn's order", () => {
    expect(loadScenario("the-uruk-hai").encounterSets.map((set) => set.name)).toEqual(["The Uruk-hai", "Orcs of the White Hand", "Snaga Orcs"]);
    expect(loadScenario("helms-deep").encounterSets.map((set) => set.name)).toEqual(["Helm's Deep", "Orcs of the White Hand"]);
    expect(loadScenario("the-road-to-isengard").encounterSets.map((set) => set.name)).toEqual(["The Road to Isengard", "Snaga Orcs"]);
    expect(loadScenario("the-passage-of-the-marshes").encounterSets.map((set) => set.name)).toEqual(["The Passage of the Marshes", "Gollum", "Morgul Nazgûl"]);
    expect(loadScenario("journey-to-the-cross-roads").encounterSets.map((set) => set.name)).toEqual(["Journey to the Cross-roads", "Men of Harad"]);
    expect(loadScenario("shelobs-lair").encounterSets.map((set) => set.name)).toEqual(["Shelob's Lair", "Gollum", "Morgul Nazgûl", "The Great Spider"]);
  });

  it("starts scenarios 7 to 9 with Aragorn (143001) and scenarios 10 to 12 with the Ring-bearer and The One Ring (144063)", () => {
    for (const id of campaign.scenarios.slice(0, 3)) expect(loadScenario(id).sagaStart, id).toEqual({ hero: "143001" });
    for (const id of campaign.scenarios.slice(3)) expect(loadScenario(id).sagaStart, id).toEqual({ ringBearer: true, attached: ["144063"] });
    // The Fellowship's six scenarios start with a Ring-bearer too, through the campaign's prelude: they record no saga start.
    for (const id of loadCampaign().scenarios) expect(loadScenario(id).sagaStart, id).toBeUndefined();
  });

  it("deals the Men of Harad and The Great Spider as second encounter decks of their own, not the burden deck", () => {
    const harad = loadScenario("journey-to-the-cross-roads").cards.filter((card) => card.pile === "haradDeck");
    expect(harad.map((card) => byCode.get(card.code)?.name).sort()).toEqual(["Haradrim Archer", "Haradrim Soldier", "Oliphaunt"]);
    expect(harad.every((card) => byCode.get(card.code)?.encounterSet === "Men of Harad")).toBe(true);
    const spider = loadScenario("shelobs-lair").cards.filter((card) => card.pile === "greatSpiderDeck");
    expect(spider.map((card) => byCode.get(card.code)?.name).sort()).toEqual(["Blocked Tunnel", "Lurking Malice", "Rage and Hunger", "Shelob's Poison"]);
    expect(spider.every((card) => byCode.get(card.code)?.encounterSet === "The Great Spider")).toBe(true);
    for (const id of campaign.scenarios) expect(loadScenario(id).cards.some((card) => card.pile === "burden"), id).toBe(false);
  });

  it("deals Gollum / Sméagol as one card with two sides, the side the Setup names faceup: Gollum in The Passage of the Marshes, Sméagol in Shelob's Lair", () => {
    expect(loadScenario("the-passage-of-the-marshes").cards.find((card) => card.pile === "setAside")).toMatchObject({ code: "144075", back: "144076" });
    expect(loadScenario("shelobs-lair").cards.find((card) => card.code === "144076")).toMatchObject({ pile: "setAside", back: "144075" });
  });

  it("leaves the boons and burdens to the campaign: Poisoned Counsels, Saruman's Voice, The Searching Eye, Brace of Coneys, A Heavy Burden and the skill boons", () => {
    expect(loadScenario("helms-deep").campaignPlaced).toEqual(["143021"]);
    expect(loadScenario("the-road-to-isengard").campaignPlaced).toEqual(["143020", "143068"]);
    expect(loadScenario("the-passage-of-the-marshes").campaignPlaced).toEqual(["144015"]);
    expect(loadScenario("journey-to-the-cross-roads").campaignPlaced).toEqual(["144014"]);
    expect(loadScenario("shelobs-lair").campaignPlaced).toEqual(["144052"]);
    expect(loadScenario("the-uruk-hai").campaignPlaced).toEqual(["143015", "143016", "143017", "143018", "143019"]);
    // The Black Gate is the quest's, staged by its Setup, and only named by the campaign card's Resolution.
    expect(loadScenario("journey-to-the-cross-roads").cards.find((card) => card.code === "144027")?.pile).toBe("staging");
  });

  it("keeps the Easy counts of the DragnCards E0C decks, each disagreement with Hall of Beorn recorded as an override with its reason", () => {
    const overrides = JSON.parse(readFileSync(path.join(DATA_DIR, "overrides.json"), "utf8")) as { scenarioEasy: { scenario: string; code: string; easy: number; reason: string }[] };
    const ours = overrides.scenarioEasy.filter((rule) => campaign.scenarios.includes(rule.scenario));
    expect(ours.map((rule) => `${rule.scenario} ${rule.code} ${rule.easy}`)).toEqual([
      "the-uruk-hai 143024 0",
      "the-passage-of-the-marshes 144021 2",
      "shelobs-lair 144059 2",
      "shelobs-lair 144060 2",
      "shelobs-lair 144061 3",
      "shelobs-lair 144062 3",
    ]);
    for (const rule of ours) expect(rule.reason).toContain("DragnCards Easy deck");
    const spider = loadScenario("shelobs-lair").cards.filter((card) => card.pile === "greatSpiderDeck");
    expect(spider.map((card) => [card.code, card.easy])).toEqual([["144059", 2], ["144060", 2], ["144061", 3], ["144062", 3]]);
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { encounterCodes } from "../../src/catalog/scenario-data.ts";

import { loadCards } from "./load-cards.ts";
import { loadCampaign, loadScenario, loadScenarioDefinitions } from "./load-scenarios.ts";

const cards = loadCards();
const byCode = new Map(cards.map((card) => [card.code, card]));

describe("scenario data", () => {
  it("deals only cards that data/cards has, and no nightmare card", () => {
    expect(() => loadScenarioDefinitions(new URL("../../data/", import.meta.url).pathname, byCode)).not.toThrow();
  });

  it("lists a scenario for every campaign entry, in booklet order", () => {
    const campaign = loadCampaign();
    expect(campaign.scenarios.length).toBeGreaterThan(0);
    const numbers = campaign.scenarios.map((id) => loadScenario(id).number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it("builds all six scenarios, each with its campaign card", () => {
    const campaign = loadCampaign();
    expect(campaign.scenarios).toEqual(["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "journey-in-the-dark", "breaking-of-the-fellowship"]);
    for (const id of campaign.scenarios) {
      const scenario = loadScenario(id);
      expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
      expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      expect(byCode.get(scenario.campaignCard)?.name, id).toBe(scenario.name);
    }
  });
});

describe("Normal deck sizes", () => {
  // The expected sizes are pins, written down from the booklet's setup (the totals of the printed Normal deck), and
  // each is re-derived from Hall of Beorn's printed Normal quantity of every encounter card of the scenario, less
  // the quest stages, the campaign cards and the boons and burdens the campaign deals (they have no encounter row), and the copies the load list sets
  // aside, stages or makes active at Setup. The load list (DragnCards) decides which pile a copy sits in; Hall of
  // Beorn decides how many copies there are, so the two sources have to agree on the total.
  const DECK = { "a-shadow-of-the-past": 40, "a-knife-in-the-dark": 35, "flight-to-the-ford": 38, "the-ring-goes-south": 30, "journey-in-the-dark": 34, "breaking-of-the-fellowship": 30 } as const;
  type Listed = { Title: string; Slug: string; EncounterSet?: string; NormalQuantity: number };
  const bySlug = new Map(cards.flatMap((card) => card.printings.flatMap((printing) => (printing.hobSlug ? [[printing.hobSlug, card.code] as const] : []))));

  it.each(Object.entries(DECK))("%s deals the printed Normal deck of %i", (id, size) => {
    const scenario = loadScenario(id);
    const raw = JSON.parse(readFileSync(new URL(`../../data/raw/hallofbeorn/Scenarios/${scenario.source.hobSlug}.json`, import.meta.url), "utf8")) as { ScenarioCards: Listed[] };
    const listed = raw.ScenarioCards.filter((item) => !/\(Campaign\)$/.test(item.Title) && !/Nightmare$/.test(item.EncounterSet ?? ""));
    const printed = new Map<string, number>();
    for (const item of listed) {
      const code = bySlug.get(item.Slug);
      if (code) printed.set(code, (printed.get(code) ?? 0) + item.NormalQuantity);
    }
    let derived = 0;
    for (const [code, quantity] of printed) {
      const card = byCode.get(code);
      const rows = scenario.cards.filter((item) => item.code === code);
      if (!card || card.type === "quest" || card.campaignKind != null || !rows.some((row) => row.pile === "encounter")) continue;
      // What the load list puts anywhere but the deck (set aside, staging, active location) is not in the deck; the locations the Setup has each
      // player find (`searched`) are in it until then.
      derived += quantity - rows.filter((row) => row.pile !== "encounter" && !row.searched).reduce((sum, row) => sum + row.normal, 0);
    }
    expect(derived).toBe(size);
    expect(encounterCodes(scenario)).toHaveLength(size);
  });
});

// Mirkwood Paths and The Dark of Mirkwood (phase 27). The Fellowship assertions above stay as they are.
describe("Mirkwood campaigns", () => {
  const paths = loadCampaign("mirkwood-paths");
  const mini = loadCampaign("the-dark-of-mirkwood");

  it("lists the scenarios of each campaign in play order, the Oath and the Caves in both", () => {
    expect(paths.scenarios).toEqual(["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur", "the-oath", "the-caves-of-nibin-dum"]);
    expect(mini.scenarios).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
    expect(mini.campaignCards).toEqual({ "the-oath": paths.campaignCards["the-oath"], "the-caves-of-nibin-dum": paths.campaignCards["the-caves-of-nibin-dum"] });
  });

  it("are not sagas: no prelude, no starter decks, and each opens its own booklet", () => {
    for (const campaign of [paths, mini]) {
      expect(campaign.saga).toBe(false);
      expect(campaign.prelude).toEqual([]);
      expect(campaign.starterDecks).toEqual([]);
    }
    expect(loadCampaign().saga).toBe(true);
    expect(loadCampaign().bookletId).toBe("fellowship-of-the-ring");
    expect(paths.bookletId).toBe("learn-to-play");
    expect(mini.bookletId).toBe("the-dark-of-mirkwood");
    expect(paths.bookletPages).toEqual({ "passage-through-mirkwood": 25, "journey-along-the-anduin": 25, "escape-from-dol-guldur": 25 });
    expect(mini.bookletPages).toEqual({ "the-oath": 3, "the-caves-of-nibin-dum": 5 });
  });

  it("builds each scenario with its campaign card, and deals only cards data/cards has", () => {
    const dataDir = new URL("../../data/", import.meta.url).pathname;
    for (const campaign of [paths, mini]) {
      expect(() => loadScenarioDefinitions(dataDir, byCode, [], campaign.id)).not.toThrow();
      for (const id of campaign.scenarios) {
        const scenario = loadScenario(id);
        expect(campaign.campaignCards[id], id).toBe(scenario.campaignCard);
        expect(byCode.get(scenario.campaignCard)?.type, id).toBe("campaign");
      }
    }
  });

  it("numbers each box's scenarios in order within the box", () => {
    expect(["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur"].map((id) => loadScenario(id).number)).toEqual([1, 2, 3]);
    expect(["the-oath", "the-caves-of-nibin-dum"].map((id) => loadScenario(id).number)).toEqual([1, 2]);
  });

  // Pins: the printed Normal deck of each scenario, with the Setup moves written down from the quest card's Setup (the ledger),
  // re-derived from Hall of Beorn's Normal quantities. The encounter deck at Normal and Easy is what encounterCodes deals.
  const DECK = {
    "passage-through-mirkwood": { normal: 34, easy: 25, staging: ["01096", "01099"], setAside: [] },
    "journey-along-the-anduin": { normal: 47, easy: 32, staging: [], setAside: [] },
    "escape-from-dol-guldur": { normal: 37, easy: 26, staging: ["01108", "01109", "01110"], setAside: ["01102"] },
    "the-oath": { normal: 31, easy: 23, staging: ["41010"], setAside: ["41019"] },
    "the-caves-of-nibin-dum": { normal: 33, easy: 25, staging: [], setAside: ["41027", "41028"] },
  } as const;

  it.each(Object.entries(DECK))("%s deals the encounter deck the quest card's Setup leaves", (id, pin) => {
    const scenario = loadScenario(id);
    expect(encounterCodes(scenario)).toHaveLength(pin.normal);
    expect(encounterCodes(scenario, "Easy")).toHaveLength(pin.easy);
    expect(scenario.cards.filter((card) => card.pile === "staging").map((card) => card.code).sort()).toEqual([...pin.staging]);
    expect(scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code).sort()).toEqual([...pin.setAside]);
    expect(scenario.source.dragnNormal).toBeNull();
  });

  it("sets Cave Torch aside for the first player to attach, and Valor, Scarred and the boons to the campaign card", () => {
    expect(loadScenario("the-caves-of-nibin-dum").cards.find((card) => card.code === "41029")?.pile).toBe("attachedChosen");
    expect(loadScenario("journey-along-the-anduin").campaignPlaced).toEqual(["01133", "01135", "01138"]);
    expect(loadScenario("the-oath").campaignPlaced).toEqual(["41041", "41043", "41044", "41045", "41046", "41047"]);
    expect(loadScenario("the-caves-of-nibin-dum").campaignPlaced).toEqual(["41042", "41048", "41049"]);
  });
});

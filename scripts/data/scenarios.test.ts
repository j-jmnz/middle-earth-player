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
  const DECK = { "a-shadow-of-the-past": 40, "a-knife-in-the-dark": 35, "flight-to-the-ford": 38, "the-ring-goes-south": 30, "journey-in-the-dark": 30, "breaking-of-the-fellowship": 30 } as const;
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
      // What the load list puts anywhere but the deck (set aside, staging, active location) is not in the deck.
      derived += quantity - rows.filter((row) => row.pile !== "encounter").reduce((sum, row) => sum + row.normal, 0);
    }
    expect(derived).toBe(size);
    expect(encounterCodes(scenario)).toHaveLength(size);
  });
});

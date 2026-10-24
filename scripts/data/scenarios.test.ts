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
  // Hall of Beorn lists the printed Normal quantity of every encounter card of a scenario. The build cross-checks each
  // card; this pins the totals, so a pile that loses a copy shows up here. The deck is the part of the total that the
  // load list shuffles in; the rest is set aside, staged or made active at Setup.
  const DECK = { "a-shadow-of-the-past": 40, "a-knife-in-the-dark": 35, "flight-to-the-ford": 38, "the-ring-goes-south": 30, "journey-in-the-dark": 30, "breaking-of-the-fellowship": 30 } as const;
  type Listed = { Title: string; EncounterSet?: string; NormalQuantity: number };

  it.each(Object.entries(DECK))("%s deals the printed Normal deck of %i", (id, size) => {
    const scenario = loadScenario(id);
    const raw = JSON.parse(readFileSync(new URL(`../../data/raw/hallofbeorn/Scenarios/${scenario.source.hobSlug}.json`, import.meta.url), "utf8")) as { ScenarioCards: Listed[] };
    const printed = raw.ScenarioCards.filter((item) => !/\(Campaign\)$/.test(item.Title) && !/Nightmare$/.test(item.EncounterSet ?? ""));
    const dealt = scenario.cards.filter((item) => item.pile !== "quest" && !scenario.campaignPlaced.includes(item.code) && byCode.get(item.code)?.campaignKind == null);
    const listed = printed.reduce((sum, item) => sum + item.NormalQuantity, 0);
    const placed = dealt.reduce((sum, item) => sum + item.normal, 0);
    // Hall of Beorn also lists quest stages and cards the campaign deals, which the load list does not hold: the
    // dealt total can only be at most the listed one. Each card's own Normal count is cross-checked in the build.
    expect(placed).toBeLessThanOrEqual(listed);
    expect(scenario.cards.filter((item) => item.pile === "encounter").reduce((sum, item) => sum + item.normal, 0)).toBe(size);
    expect(encounterCodes(scenario)).toHaveLength(size);
  });
});

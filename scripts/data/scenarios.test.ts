import { describe, expect, it } from "vitest";

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

  it("offers rewards that the scenario deals", () => {
    const campaign = loadCampaign();
    for (const [id, groups] of Object.entries(campaign.authored.resolution)) {
      const dealt = new Set(loadScenario(id).cards.map((card) => card.code));
      for (const group of groups) for (const choice of group.choices) expect(dealt.has(choice.code), `${id} ${group.id} ${choice.code}`).toBe(true);
    }
  });
});

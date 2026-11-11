// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

const campaign = loadCampaign("the-two-towers");
const roads = loadScenario("journey-to-the-cross-roads");

// Journey to the Cross-roads in the the-two-towers campaign (part 5, campaign card 144069). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("Journey to the Cross-roads in the the-two-towers campaign", () => {
  it("is part 5 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(roads.id)).toBe(4);
    expect(roads.campaignCard).toBe("144069");
  });

  it.todo("is playable (src/campaign/playable.ts), and the path offers it after the earlier parts");
  it.todo("deals the Campaign Setup: the cards the campaign card places, set aside as it says");
  it.todo("hands the previous parts to this one: the pool, the XP and the marks reach the game");
  it.todo("deals the original card in a standalone game, with no campaign card");
});

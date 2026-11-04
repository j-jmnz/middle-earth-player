// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { CODES, campaign, ruins } from "../../../../test/scenarios/the-drowned-ruins/scene.ts";

// The Drowned Ruins in the dream-chaser campaign (part 7, campaign card 11200). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("The Drowned Ruins in the dream-chaser campaign", () => {
  it("is part 7 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(ruins.id)).toBe(6);
    expect(ruins.campaignCard).toBe(CODES.campaignCard);
  });

  it.todo("is playable (src/campaign/playable.ts), and the path offers it after the earlier parts");
  it.todo("deals the Campaign Setup: the cards the campaign card places, set aside as it says");
  it.todo("hands the previous parts to this one: the pool, the XP and the marks reach the game");
  it.todo("deals the original card in a standalone game, with no campaign card");
});

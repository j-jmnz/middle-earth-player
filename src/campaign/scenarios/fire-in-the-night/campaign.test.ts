// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { CODES, campaign, night } from "../../../../test/scenarios/fire-in-the-night/scene.ts";

// Fire in the Night in the ered-mithrin campaign (part 6, campaign card 12187). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("Fire in the Night in the ered-mithrin campaign", () => {
  it("is part 6 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(night.id)).toBe(5);
    expect(night.campaignCard).toBe(CODES.campaignCard);
  });

  it.todo("is playable (src/campaign/playable.ts), and the path offers it after the earlier parts");
  it.todo("deals the Campaign Setup: the cards the campaign card places, set aside as it says");
  it.todo("hands the previous parts to this one: the pool, the XP and the marks reach the game");
  it.todo("deals the original card in a standalone game, with no campaign card");
});

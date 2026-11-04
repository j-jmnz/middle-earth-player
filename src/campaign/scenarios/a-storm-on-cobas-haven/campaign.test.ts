// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { CODES, campaign, haven } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";

// A Storm on Cobas Haven in the dream-chaser campaign (part 8, campaign card 11209). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("A Storm on Cobas Haven in the dream-chaser campaign", () => {
  it("is part 8 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(haven.id)).toBe(7);
    expect(haven.campaignCard).toBe(CODES.campaignCard);
  });

  it.todo("is playable (src/campaign/playable.ts), and the path offers it after the earlier parts");
  it.todo("deals the Campaign Setup: the cards the campaign card places, set aside as it says");
  it.todo("hands the previous parts to this one: the pool, the XP and the marks reach the game");
  it.todo("deals the original card in a standalone game, with no campaign card");
});

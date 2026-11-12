// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

const campaign = loadCampaign("angmar-awakened");
const gram = loadScenario("escape-from-mount-gram");

// Escape from Mount Gram in the angmar-awakened campaign (part 5, campaign card 10174). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("Escape from Mount Gram in the angmar-awakened campaign", () => {
  it("is part 5 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(gram.id)).toBe(4);
    expect(gram.campaignCard).toBe("10174");
  });

  it.todo("is playable (src/campaign/playable.ts), and the path offers it after the earlier parts");
  it.todo("deals the Campaign Setup: the cards the campaign card places, set aside as it says");
  // The previous parts' logs come from their golden states (goldenState, test/harness/golden-state.ts), never from playing their goldens again;
  // this scenario's own won or lost state too, once its goldens are pinned (.claude/rules/code-standards.md, Test cost).
  it.todo("hands the previous parts to this one: the pool, the XP and the marks reach the game");
  it.todo("deals the original card in a standalone game, with no campaign card");
});

// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

const campaign = loadCampaign("the-return-of-the-king");
const ungol = loadScenario("the-tower-of-cirith-ungol");

// The Tower of Cirith Ungol in the the-return-of-the-king campaign (part 4, campaign card 146069). The first check reads data/; the todos are what the campaign test of every
// scenario shows (src/campaign/scenarios/the-thing-in-the-depths/campaign.test.ts is the pattern). TODO: turn each into a test once the scenario's records exist.
describe("The Tower of Cirith Ungol in the the-return-of-the-king campaign", () => {
  it("is part 4 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(ungol.id)).toBe(3);
    expect(ungol.campaignCard).toBe("146069");
  });

  it.todo("is playable (src/campaign/playable.ts), and the path offers it after the earlier parts");
  it.todo("deals the Campaign Setup: the cards the campaign card places, set aside as it says");
  // The previous parts' logs come from their golden states (goldenState, test/harness/golden-state.ts), never from playing their goldens again;
  // this scenario's own won or lost state too, once its goldens are pinned (.claude/rules/code-standards.md, Test cost).
  it.todo("hands the previous parts to this one: the pool, the XP and the marks reach the game");
  it.todo("deals the original card in a standalone game, with no campaign card");
});

// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const gollum = loadAnyScenario("the-hunt-for-gollum");

// The Hunt for Gollum in the shadows-of-mirkwood cycle (part 1). A cycle has no Campaign Mode: the scenario has no campaign card, no log, no XP and no next part, and is played standalone only. The first check
// reads data/; the todos are what the standalone test of every cycle scenario shows (src/campaign/standalone-game.test.ts and src/campaign/cycle-shell.test.ts are the pattern).
// TODO: turn each into a test once the scenario's records exist.
describe("The Hunt for Gollum in the shadows-of-mirkwood cycle", () => {
  it("is part 1 of the cycle and has no campaign card", () => {
    expect(cycle.kind).toBe("cycle");
    expect(cycle.scenarios.indexOf(gollum.id)).toBe(0);
    expect(gollum.campaignCard).toBeUndefined();
  });

  it.todo("is playable (src/campaign/playable.ts), and the Scenarios tab lists it in the cycle's fold");
  it.todo("deals standalone with nothing from a campaign: no checklist, no log, no Resolution to follow on a win");
  it.todo("deals its Nightmare deck on Nightmare when every card of it has a record (src/campaign/playable.ts)");
});

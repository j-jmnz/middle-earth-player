// Rules: rr.victory (data/rules/entries.json); ledger lines 12195:B:1, 11215:B:4.
// The words of a campaign won, read from the printed-text ledger and the campaign data: the campaign card's Resolution line, the name and the count of scenarios.
import { describe, expect, it } from "vitest";

import { campaignOf, scenarioOf } from "../data/campaign-data";
import { campaignEnd } from "./campaign-end";

const endOf = (campaignId: string) => {
  const campaign = campaignOf(campaignId);
  if (!campaign) throw new Error(`no campaign ${campaignId}`);
  const last = campaign.scenarios.at(-1) ?? "";
  return campaignEnd(campaign, scenarioOf(last)?.campaignCard ?? null);
};

describe("the end of a campaign", () => {
  it("Ered Mithrin and Dream-chaser say the printed Resolution line, without its label, and how many scenarios were won", () => {
    expect(endOf("ered-mithrin")).toEqual({ won: "Ered Mithrin won. The players win the campaign!", line: "The players win the campaign!", summary: "Ered Mithrin is complete: 9 of 9 scenarios won." });
    const dreamChaser = endOf("dream-chaser");
    expect(dreamChaser.line).toBe("The players win the campaign!");
    expect(dreamChaser.won).toBe(`${campaignOf("dream-chaser")?.name} won. The players win the campaign!`);
  });

  it("a campaign card that prints no such line is only won", () => {
    const campaign = { name: "Mirkwood Paths", scenarios: ["a", "b"] };
    expect(campaignEnd(campaign, null)).toEqual({ won: "Mirkwood Paths won.", line: null, summary: "Mirkwood Paths is complete: 2 of 2 scenarios won." });
  });
});

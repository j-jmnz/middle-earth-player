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
    expect(endOf("ered-mithrin")).toEqual({ won: "Ered Mithrin won. The players win the campaign!", line: "The players win the campaign!", summary: "Ered Mithrin is complete: 9 of 9 scenarios won.", tone: "default" });
    const dreamChaser = endOf("dream-chaser");
    expect(dreamChaser.line).toBe("The players win the campaign!");
    expect(dreamChaser.won).toBe(`${campaignOf("dream-chaser")?.name} won. The players win the campaign!`);
  });

  it("The Return of the King words its end from the log, never from the option lines of Mount Doom's card", () => {
    const campaign = campaignOf("the-return-of-the-king");
    if (!campaign) throw new Error("no campaign the-return-of-the-king");
    const card = scenarioOf(campaign.scenarios.at(-1) ?? "")?.campaignCard ?? null;
    const won = campaignEnd(campaign, card, "won");
    expect(won).toEqual({ won: "The Return of the King won. The One Ring is destroyed. The players win the campaign.", line: "The One Ring is destroyed. The players win the campaign.", summary: "The Return of the King is complete: 6 of 6 scenarios won.", tone: "default" });
    const lost = campaignEnd(campaign, card, "lost");
    expect(lost).toEqual({ won: "The Return of the King lost. The One Ring is kept. The players lose the campaign.", line: "The One Ring is kept. The players lose the campaign.", summary: null, tone: "danger" });
    for (const end of [won, lost]) expect(`${end.won} ${end.line}`).not.toMatch(/^-|Destroy The One Ring card/);
  });

  it("the Fellowship and The Two Towers say what their cards print, as before", () => {
    for (const id of ["fellowship-of-the-ring", "the-two-towers"]) {
      const printed = endOf(id);
      expect(printed.tone).toBe("default");
      expect(printed.summary).toContain("scenarios won");
      expect(printed.won).toBe(printed.line ? `${campaignOf(id)?.name} won. ${printed.line}` : `${campaignOf(id)?.name} won.`);
      expect(campaignEnd(campaignOf(id) ?? { name: "", scenarios: [] }, scenarioOf(campaignOf(id)?.scenarios.at(-1) ?? "")?.campaignCard ?? null, null)).toEqual(printed);
    }
  });

  it("a campaign card that prints no such line is only won", () => {
    const campaign = { name: "Mirkwood Paths", scenarios: ["a", "b"] };
    expect(campaignEnd(campaign, null)).toEqual({ won: "Mirkwood Paths won.", line: null, summary: "Mirkwood Paths is complete: 2 of 2 scenarios won.", tone: "default" });
  });
});

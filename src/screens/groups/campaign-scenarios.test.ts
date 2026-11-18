// The rows that open a campaign's scenarios as card groups, and the words of the campaign setup's rows.
import { describe, expect, it } from "vitest";

import { campaignOf } from "../data/campaign-data.ts";
import { encounterWords, scenarioRows, stagesWords } from "./campaign-scenarios.ts";

describe("the campaign's scenario rows", () => {
  const scenarios = campaignOf("dream-chaser")?.scenarios ?? [];

  it("lists the scenarios in book order with their place and their sets", () => {
    const rows = scenarioRows(scenarios);
    expect(rows).toHaveLength(9);
    expect(rows[0]).toEqual({ id: "voyage-across-belegaer", number: 1, name: "Voyage Across Belegaer", detail: "Scenario 1 · 6 sets · 36 cards" });
  });

  it("starts after the first for the campaign setup's Later scenarios", () => {
    const rows = scenarioRows(scenarios, 1);
    expect(rows.map((row) => row.number)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rows[0]?.id).toBe("the-fate-of-numenor");
  });

  it("says the counts in words", () => {
    expect(encounterWords([{ count: 1 }])).toBe("1 set · 1 card");
    expect(stagesWords(1)).toBe("Stage 1");
    expect(stagesWords(3)).toBe("Stages 1 to 3");
  });
});

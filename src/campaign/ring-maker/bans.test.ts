// Rules: rm.grima-objective-ally, rr.unique-cards (data/rules/entries.json); ledger line 07016:A:1.
// The hero Gríma (07002) is refused in The Fords of Isen, where the objective ally Gríma is in play, and in no other scenario.
import { describe, expect, it } from "vitest";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { titleBansOf } from "../saga.ts";

describe("the title ban of The Fords of Isen", () => {
  const cycle = loadCampaign("the-ring-maker");

  it("07016:A:1 refuses the hero Gríma and names the rule", () => {
    expect(titleBansOf(cycle, loadAnyScenario("the-fords-of-isen"))).toEqual([{ title: "Gríma", types: ["hero"], rule: "rm.grima-objective-ally" }]);
  });

  it("bans nothing in another scenario of the cycle or in another box", () => {
    expect(titleBansOf(cycle, loadAnyScenario("to-catch-an-orc"))).toEqual([]);
    expect(titleBansOf(loadCampaign("the-hobbit"), loadAnyScenario("the-fords-of-isen"))).toEqual([]);
  });
});

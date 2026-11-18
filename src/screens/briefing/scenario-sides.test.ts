import { describe, expect, it } from "vitest";

import { campaignCardEntries, campaignSides, questSides } from "./scenario-sides.ts";

describe("the briefing's quest cards (user request, 2026-11-01)", () => {
  it("shows each stage on side A then side B, in stage order, labelled by stage and side", () => {
    expect(questSides(["141023"])).toEqual([
      { code: "141023", side: "A", label: "Stage 1A" },
      { code: "141023", side: "B", label: "Stage 1B" },
    ]);
    expect(questSides(["a", "b", "c"]).map((entry) => entry.label)).toEqual(["Stage 1A", "Stage 1B", "Stage 2A", "Stage 2B", "Stage 3A", "Stage 3B"]);
    expect(questSides([])).toEqual([]);
  });
});

describe("the campaign setup's campaign cards (user request, 2026-11-18)", () => {
  const scenarios = [
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
    { id: "three", name: "Three" },
  ];
  it("lists each scenario's card in book order and leaves out a scenario with none", () => {
    expect(campaignCardEntries(scenarios, { three: "c3", one: "c1" })).toEqual([
      { code: "c1", scenario: "One" },
      { code: "c3", scenario: "Three" },
    ]);
    expect(campaignCardEntries(scenarios, {})).toEqual([]);
  });
  it("shows each card on side A (Setup) then side B (Resolution), labelled with its scenario", () => {
    expect(campaignSides([{ code: "c1", scenario: "One" }])).toEqual([
      { code: "c1", side: "A", label: "One · Setup" },
      { code: "c1", side: "B", label: "One · Resolution" },
    ]);
  });
});

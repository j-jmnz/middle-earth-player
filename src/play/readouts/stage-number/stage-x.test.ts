// Rules: rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51011:A:2, 146070:A:2, 16035:A:1.
// A card whose stat is the stage number plus or times a number says so in its preview, and the line of another reader (a Captive, a plot) is told with it.
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

import { dungeonDetail } from "../../cards/dungeon-preview.ts";

const line = (scenario: string, code: string, layout: Parameters<typeof tableFromLayout>[1]) => {
  const t = tableFromLayout(scenario, layout);
  const state = settle(t.state, t.ctx, []);
  return dungeonDetail(state, t.ctx, idOf(state, code), (id) => id);
};

describe("a stat that is the stage number plus or times a number", () => {
  it("51011:A:2 says Rider of Mirkwood's Threat is 1 more than the stage number, never the bare stage number", () => {
    const said = line("the-wizards-quest", "51011", { phase: "Quest", staging: ["51011"] }) ?? "";
    expect(said).toContain("Threat is 1 more than the stage number of the main quest");
    expect(said).not.toContain("X is the stage number");
  });

  it("146070:A:2 says The Two Watchers' Threat is twice the stage number", () => {
    const said = line("the-tower-of-cirith-ungol", "146070", { phase: "Quest", stage: "146013", staging: ["146070"] }) ?? "";
    expect(said).toContain("Threat is twice the stage number of the main quest");
  });
});

import { describe, expect, it } from "vitest";

import { blankScenario } from "../rules/core/state.ts";
import { loadWorld } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";

import { wonSheet } from "./sheets.ts";

// A won campaign game opens the campaign card's Resolution; a standalone one has no campaign card (rr.campaign-cards),
// so its won sheet offers no rewards.
describe("the won sheet", () => {
  it("offers the campaign card's rewards in Campaign Mode", async () => {
    const { definition } = await loadWorld();
    const game = { ...blankScenario({ seatCount: 1, seed: 1, definition }), stageCleared: true };
    expect(game.resolution.length).toBeGreaterThan(0);
    expect(wonSheet(game)).toMatchObject({ step: "Resolution", note: "The scenario is won. Choose the rewards the campaign card offers.", action: "Choose rewards" });
  });

  it("names no reward in a standalone game", async () => {
    const { definition } = await loadWorld();
    const game = { ...blankScenario({ seatCount: 1, seed: 1, definition: { ...definition, resolution: [] } }), stageCleared: true };
    expect(wonSheet(game)).toMatchObject({ step: "Scenario", note: "The scenario is won.", action: "See the score" });
  });
});

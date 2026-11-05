// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { CORSAIRS_GOLDENS, playGolden, corsairsWorld, type CorsairsDecks, type CorsairsGolden } from "../../../../test/scenarios/the-city-of-corsairs/game.ts";
import { campaign, corsairs } from "../../../../test/scenarios/the-city-of-corsairs/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of The City of Corsairs in Campaign Mode played by the auto-player (test/scenarios/the-city-of-corsairs/game.ts) on fixed seeds, through a win and through each way to lose.
// TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill CORSAIRS_GOLDENS, change `describe.skip` to `describe`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("The City of Corsairs golden (open: scaffold)", () => {
  goldenSuite<CorsairsGolden, CorsairsDecks>({
    title: "The City of Corsairs",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: corsairs,
    goldens: CORSAIRS_GOLDENS,
    world: corsairsWorld,
    play: playGolden,
    opening: {
      title: "TODO: starts with (the staging area, the cards set aside, the encounter deck, the quest stage)",
      check(state, golden) {
        // TODO: the opening the Setup leaves.
        expect(state.questStage, golden.name).toBeTruthy();
      },
    },
    wins: "TODO: wins when ..., runs 11215's Resolution and unlocks the next part",
    won(state) {
      // TODO: the stage the game ended on and what the Resolution earned.
      expect(state.stageCleared).toBe(true);
    },
    // TODO: expectedXp(state, golden): what the campaign card's list awards, counted from the final state.
  });
});

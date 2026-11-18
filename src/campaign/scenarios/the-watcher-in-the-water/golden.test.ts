// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { WATER_GOLDENS, playGolden, waterWorld, type WaterDecks, type WaterGolden } from "../../../../test/scenarios/the-watcher-in-the-water/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const water = loadAnyScenario("the-watcher-in-the-water");

// A permanent golden: whole standalone games of The Watcher in the Water played by the auto-player (test/scenarios/the-watcher-in-the-water/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill WATER_GOLDENS, change `describe.skip` to `describe`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("The Watcher in the Water golden (open: scaffold)", () => {
  goldenSuite<WaterGolden, WaterDecks>({
    title: "The Watcher in the Water",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: water,
    standalone: true,
    goldens: WATER_GOLDENS,
    world: waterWorld,
    play: playGolden,
    opening: {
      title: "TODO: starts with (the staging area, the cards set aside, the encounter deck, the quest stage)",
      check(state, golden) {
        // TODO: the opening the Setup leaves.
        expect(state.questStage, golden.name).toBeTruthy();
      },
    },
    wins: "TODO: wins when ..., settles with a score and earns nothing",
    won(state) {
      // TODO: the stage the game ended on.
      expect(state.stageCleared).toBe(true);
    },
  });
});

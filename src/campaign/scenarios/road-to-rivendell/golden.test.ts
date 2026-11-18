// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { RIVENDELL_GOLDENS, playGolden, rivendellWorld, type RivendellDecks, type RivendellGolden } from "../../../../test/scenarios/road-to-rivendell/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const rivendell = loadAnyScenario("road-to-rivendell");

// A permanent golden: whole standalone games of Road to Rivendell played by the auto-player (test/scenarios/road-to-rivendell/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill RIVENDELL_GOLDENS, change `describe.skip` to `describe`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("Road to Rivendell golden (open: scaffold)", () => {
  goldenSuite<RivendellGolden, RivendellDecks>({
    title: "Road to Rivendell",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: rivendell,
    standalone: true,
    goldens: RIVENDELL_GOLDENS,
    world: rivendellWorld,
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

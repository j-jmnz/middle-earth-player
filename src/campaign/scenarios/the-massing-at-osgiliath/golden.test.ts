// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { OSGILIATH_GOLDENS, playGolden, osgiliathWorld, type OsgiliathDecks, type OsgiliathGolden } from "../../../../test/scenarios/the-massing-at-osgiliath/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const osgiliath = loadAnyScenario("the-massing-at-osgiliath");

// A permanent golden: whole standalone games of The Massing at Osgiliath played by the auto-player (test/scenarios/the-massing-at-osgiliath/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill OSGILIATH_GOLDENS, change `describe.skip` to `describe`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("The Massing at Osgiliath golden (open: scaffold)", () => {
  goldenSuite<OsgiliathGolden, OsgiliathDecks>({
    title: "The Massing at Osgiliath",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: osgiliath,
    standalone: true,
    goldens: OSGILIATH_GOLDENS,
    world: osgiliathWorld,
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

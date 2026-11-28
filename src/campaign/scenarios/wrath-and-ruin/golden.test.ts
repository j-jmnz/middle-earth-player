// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { RUIN_GOLDENS, playGolden, ruinWorld, type RuinDecks, type RuinGolden } from "../../../../test/scenarios/wrath-and-ruin/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("vengeance-of-mordor");
const ruin = loadAnyScenario("wrath-and-ruin");

// A permanent golden: whole standalone games of Wrath and Ruin played by the auto-player (test/scenarios/wrath-and-ruin/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill RUIN_GOLDENS, change `describe.skip` to `describe`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("Wrath and Ruin golden (open: scaffold)", () => {
  goldenSuite<RuinGolden, RuinDecks>({
    title: "Wrath and Ruin",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: ruin,
    standalone: true,
    goldens: RUIN_GOLDENS,
    world: ruinWorld,
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

// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { DIN_GOLDENS, playGolden, dinWorld, type DinDecks, type DinGolden } from "../../../../test/scenarios/encounter-at-amon-din/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const din = loadAnyScenario("encounter-at-amon-din");

// A permanent golden: whole standalone games of Encounter at Amon Dîn played by the auto-player (test/scenarios/encounter-at-amon-din/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill DIN_GOLDENS, change `describe.skip` to `describe`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("Encounter at Amon Dîn golden (open: scaffold)", () => {
  goldenSuite<DinGolden, DinDecks>({
    title: "Encounter at Amon Dîn",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: din,
    standalone: true,
    goldens: DIN_GOLDENS,
    world: dinWorld,
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

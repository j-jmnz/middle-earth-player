// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, expect } from "vitest";

import { LAIR_GOLDENS, playGolden, lairWorld, type LairDecks, type LairGolden } from "../../../../test/scenarios/shelobs-lair/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-two-towers");
const lair = loadScenario("shelobs-lair");

// A permanent golden: whole games of Shelob's Lair in Campaign Mode played by the auto-player (test/scenarios/shelobs-lair/game.ts) on fixed seeds, through a win and through each way to lose.
// TODO: say what the games cover. Update the snapshot only when the change is meant.
//
// Open until the goldens are chosen: the suite is skipped, so it writes no golden.json. To finish it, fill LAIR_GOLDENS, change `describe.skip` to `describe`, fill the TODOs below, run this file
// (it writes golden.json) and uncomment this scenario's two lines in test/harness/golden-registry.ts (its test fails on a golden.json that is not listed).
describe.skip("Shelob's Lair golden (open: scaffold)", () => {
  goldenSuite<LairGolden, LairDecks>({
    title: "Shelob's Lair",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: lair,
    goldens: LAIR_GOLDENS,
    world: lairWorld,
    play: playGolden,
    opening: {
      title: "TODO: starts with (the staging area, the cards set aside, the encounter deck, the quest stage)",
      check(state, golden) {
        // TODO: the opening the Setup leaves.
        expect(state.questStage, golden.name).toBeTruthy();
      },
    },
    wins: "TODO: wins when ..., runs 144073's Resolution and unlocks the next part",
    won(state) {
      // TODO: the stage the game ended on and what the Resolution earned.
      expect(state.stageCleared).toBe(true);
    },
    // TODO: expectedXp(state, golden): what the campaign card's list awards, counted from the final state.
  });
});

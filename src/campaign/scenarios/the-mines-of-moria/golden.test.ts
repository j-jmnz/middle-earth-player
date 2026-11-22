// Rules: rr.setup, rr.search, rr.travel, rr.engaged, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, rr.ownership-and-control, ltp.scoring, docs/scenarios/standalone-scenarios.md (The Mines of Moria) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { MINES_GOLDENS, playGolden, minesWorld, type MinesDecks, type MinesGolden } from "../../../../test/scenarios/the-mines-of-moria/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const mines = loadAnyScenario("the-mines-of-moria");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// A permanent golden: whole standalone games of The Mines of Moria played by the auto-player (test/scenarios/the-mines-of-moria/game.ts) on fixed seeds, through wins with three pairs of stage cards and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed: The Watcher is defeated at stage 1B and flips into Chamber of Mazarbul, the players travel to it at
// stage 3B and the stage 3 card of the first player's choice is defeated. The losses are every player's threat at 50 (heroes too small to quest) and every hero destroyed (brittle heroes). Update the snapshot only when the change is meant.
describe("The Mines of Moria golden", () => {
  goldenSuite<MinesGolden, MinesDecks>({
    title: "The Mines of Moria",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: mines,
    standalone: true,
    goldens: MINES_GOLDENS,
    world: minesWorld,
    play: playGolden,
    opening: {
      title: "opens on To the West-door with The Watcher in the staging area, each hero holding a resource, the encounter deck built from 7 of the 14 sets (35 cards) and the 3 stage cards of the first player's choice the only ones in the quest deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("51201");
        expect(codesOf(state, state.staging), golden.name).toContain("51210");
        // The first player has chosen one stage 2 and one stage 3 card; the other four wait out of the game.
        expect(state.stages.map((stage) => stage.code), golden.name).toHaveLength(3);
        expect(state.stages[0]?.code, golden.name).toBe("51201");
        for (const seat of state.seats.slice(0, golden.seatCount)) for (const hero of seat.heroes) expect(state.cards[hero]?.resources, golden.name).toBeGreaterThanOrEqual(1);
        // 7 sets of 5 cards (standalone.test.ts counts the sets).
        expect(state.encounterDeck.length, golden.name).toBe(35);
      },
    },
    wins: "wins when the stage 3 card of the first player's choice is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(["51207", "51208", "51209"], golden.name).toContain(state.cards[state.questStage ?? ""]?.code);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
      // The Watcher flipped into Chamber of Mazarbul, which is in the victory display or still in play for the stage 3 cards that do not need it.
      expect(Object.values(state.cards).some((card) => card.code === "51211"), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

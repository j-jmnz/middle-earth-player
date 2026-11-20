// Rules: rr.setup, rr.search, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, rr.guarded, ltp.scoring, docs/brief.md (The Wizard's Quest) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { QUEST_GOLDENS, playGolden, questWorld, type QuestDecks, type QuestGolden } from "../../../../test/scenarios/the-wizards-quest/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const quest = loadAnyScenario("the-wizards-quest");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// A permanent golden: whole standalone games of The Wizard's Quest played by the auto-player (test/scenarios/the-wizards-quest/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed with the three pairs of stage cards the policy picks (A Fork in the Road and The Necromancer's Tower,
// Carried Away and Dungeons of the Necromancer, A New Terror Abroad and Return to Rhosgobel): the players explore Rhosgobel, fight Rider of Mirkwood and win at stage 3. The losses are every player's threat at 50 (heroes too
// small to quest) and every hero destroyed. Update the snapshot only when the change is meant.
describe("The Wizard's Quest golden", () => {
  goldenSuite<QuestGolden, QuestDecks>({
    title: "The Wizard's Quest",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: quest,
    standalone: true,
    goldens: QUEST_GOLDENS,
    world: questWorld,
    play: playGolden,
    opening: {
      title: "opens on Radagast's Request with Rhosgobel in the staging area, the encounter deck built from 7 of the 14 sets (35 cards) and the 3 stage cards of the first player's choice the only ones in the quest deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("51001");
        expect(codesOf(state, state.staging), golden.name).toContain("51010");
        // The first player has chosen one stage 2 and one stage 3 card; the other four wait out of the game.
        expect(state.stages.map((stage) => stage.code), golden.name).toHaveLength(3);
        expect(state.stages[0]?.code, golden.name).toBe("51001");
        const sets = new Set(state.encounterDeck.map((id) => state.cards[id]?.encounterSet).filter((set) => set != null));
        expect(sets.size, golden.name).toBeLessThanOrEqual(7);
      },
    },
    wins: "wins when the stage 3 card of the first player's choice is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(["51007", "51008", "51009"], golden.name).toContain(state.cards[state.questStage ?? ""]?.code);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
      // Rhosgobel flipped into Rider of Mirkwood, so Rhosgobel is no longer in play as a location.
      expect(Object.values(state.cards).some((card) => card.code === "51010" && card.zone === "activeLocation"), golden.name).toBe(false);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

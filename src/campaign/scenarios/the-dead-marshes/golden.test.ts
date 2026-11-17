// Rules: rr.setup, sotm.setup-the-dead-marshes, sotm.escape-test, sotm.reset-the-quest-deck, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { DEADMARSHES_GOLDENS, playGolden, deadmarshesWorld, type DeadmarshesDecks, type DeadmarshesGolden } from "../../../../test/scenarios/the-dead-marshes/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const deadmarshes = loadAnyScenario("the-dead-marshes");

const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Dead Marshes played by the auto-player (test/scenarios/the-dead-marshes/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal (each after a quest deck reset: a capture that fails sends the quest back to stage 1B), solo on Easy and two-handed on Nightmare: the players fill the quest's two stages, make the escape tests the
// encounter cards and Gollum ask, and win by passing stage 2B's own test. The losses are each way to lose, every player's threat at 50 and every hero destroyed. The opening, the causes, a replay and the scoring are checked for each.
// Update the snapshot only when the change is meant.
describe("The Dead Marshes golden", () => {
  goldenSuite<DeadmarshesGolden, DeadmarshesDecks>({
    title: "The Dead Marshes",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: deadmarshes,
    standalone: true,
    goldens: DEADMARSHES_GOLDENS,
    world: deadmarshesWorld,
    play: playGolden,
    opening: {
      title: "starts with Into the Marshes as the quest stage, Gollum found and set in the staging area, and on Nightmare the setup card out of play",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02105");
        expect(cardsOf(state, "02107").map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, "900801").map((card) => card.zone), golden.name).toEqual(golden.difficulty === "Nightmare" ? ["nightmare"] : []);
      },
    },
    wins: "ends on The Capture with its escape test passed, which wins the game, settles at once with a score and earns nothing",
    won(state, golden) {
      // The last stage holds the win until its own test is passed, so the game ends with it still the current stage.
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02106");
      expect(state.cards[state.questStage ?? ""]?.progress, golden.name).toBeGreaterThanOrEqual(3);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

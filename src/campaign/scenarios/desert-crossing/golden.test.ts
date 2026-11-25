// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.engaged, hrd.heat-tracker, hrd.setup-desert-crossing (data/rules/entries.json).
import { describe, expect } from "vitest";

import { temperatureOf } from "../../../rules/families/haradrim/heat.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import { CROSSING_GOLDENS, playGolden, crossingWorld, type CrossingDecks, type CrossingGolden } from "../../../../test/scenarios/desert-crossing/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const crossing = loadAnyScenario("desert-crossing");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Desert Crossing played by the auto-player (test/scenarios/desert-crossing/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed: the players quest through the three stages, engage the Were-worms stage 3B adds and defeat 3B
// before the temperature reaches 60. The losses are the three ways to lose: the temperature at 60, every player's threat at 50 and every hero destroyed. Update the snapshot only when the change is meant.
describe("Desert Crossing golden", () => {
  goldenSuite<CrossingGolden, CrossingDecks>({
    title: "Desert Crossing",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: crossing,
    standalone: true,
    goldens: CROSSING_GOLDENS,
    world: crossingWorld,
    play: playGolden,
    opening: {
      title: "starts on The Desert of Harad (1A flipped to 1B by its Setup) with the temperature at 10 and one Burnt Sands for each player in the staging area",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "16068", face: "B", zone: "questStage" });
        expect(temperatureOf(state), golden.name).toBe(10);
        expect(cardsOf(state, "16025").filter((card) => card.zone === "staging"), golden.name).toHaveLength(golden.seatCount);
      },
    },
    wins: "ends when stage 3B (Beasts of Legend) is defeated with no Were-worm in play, settles at once with a score and earns nothing",
    won(state, golden) {
      // The game ended on the last stage: no Were-worm is in play and the temperature stayed under 60.
      expect(state.stageCleared, golden.name).toBe(true);
      expect(cardsOf(state, "16028").filter((card) => card.zone === "staging" || card.zone === "engaged"), golden.name).toEqual([]);
      expect(temperatureOf(state) ?? 0, golden.name).toBeLessThan(60);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.decks === "tense") {
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      } else if (golden.decks === "brittle") {
        expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      } else {
        // The temperature reached 60 with the players alive.
        expect(temperatureOf(state), golden.name).toBeGreaterThanOrEqual(60);
        expect(seats.some((seat) => !seat.eliminated), golden.name).toBe(true);
      }
    },
  });
});

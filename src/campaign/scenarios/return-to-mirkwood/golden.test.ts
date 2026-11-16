// Rules: rr.setup, sotm.setup-return-to-mirkwood, sotm.guarding-gollum, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { guardianSeat } from "../../../rules/families/guardian/seats.ts";

import { RETURNMIRKWOOD_GOLDENS, playGolden, returnmirkwoodWorld, type ReturnmirkwoodDecks, type ReturnmirkwoodGolden } from "../../../../test/scenarios/return-to-mirkwood/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const returnmirkwood = loadAnyScenario("return-to-mirkwood");

const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Return to Mirkwood played by the auto-player (test/scenarios/return-to-mirkwood/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, solo on Easy and two-handed on Nightmare: one hero of each seat quests, the others stay ready to defend the guard, and the players clear the last stage by killing every enemy in play. The losses are each
// way to lose: Gollum destroyed (an attack no hero defends), every player's threat at 50, every hero destroyed, and the guard eliminated while the other player stays in. The opening, the causes, a replay and the scoring are checked for each.
// Update the snapshot only when the change is meant.
describe("Return to Mirkwood golden", () => {
  goldenSuite<ReturnmirkwoodGolden, ReturnmirkwoodDecks>({
    title: "Return to Mirkwood",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: returnmirkwood,
    standalone: true,
    goldens: RETURNMIRKWOOD_GOLDENS,
    world: returnmirkwoodWorld,
    play: playGolden,
    opening: {
      title: "starts with Through the Forest as the quest stage, Gollum out of the encounter deck and in front of the player guarding him, and on Nightmare the setup card out of play",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02126");
        expect(cardsOf(state, "02130")).toHaveLength(1);
        expect(cardsOf(state, "900901").map((card) => card.zone), golden.name).toEqual(golden.difficulty === "Nightmare" ? ["nightmare"] : []);
      },
    },
    wins: "ends on Ambush with no enemy in play, which defeats the last stage and wins the game with Gollum still in front of the guard, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02129");
      expect(state.stageCleared, golden.name).toBe(true);
      const gollum = cardsOf(state, "02130")[0];
      expect(gollum?.zone, golden.name).toBe("play");
      expect(guardianSeat(state), golden.name).not.toBeNull();
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      const gollum = cardsOf(state, "02130")[0];
      if (golden.name === "solo loss: Gollum destroyed") {
        // The way to lose that is the card's own: Gollum leaves play while the guard is still in the game.
        expect(gollum?.zone, golden.name).not.toBe("play");
        expect(seats.every((seat) => seat.eliminated), golden.name).toBe(false);
      } else if (golden.name === "two-handed loss: the guard eliminated") {
        // The guard's threat reached 50 and he left the game; the other player stays in, and Gollum with him, which loses.
        expect(seats.filter((seat) => seat.eliminated)).toHaveLength(1);
        expect(seats[0]?.eliminated, golden.name).toBe(true);
        expect(seats[0]?.threat, golden.name).toBeGreaterThanOrEqual(50);
        expect(gollum?.zone, golden.name).not.toBe("play");
      } else {
        expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
        // Gollum is alive in both: the players are eliminated, by threat 50 or by losing every hero.
        expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
      }
    },
  });
});

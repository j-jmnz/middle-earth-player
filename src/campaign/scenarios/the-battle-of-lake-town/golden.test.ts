// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.scoring, docs/brief.md (The Battle of Lake-town) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { TOWN_GOLDENS, playGolden, townWorld, type TownDecks, type TownGolden } from "../../../../test/scenarios/the-battle-of-lake-town/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const town = loadAnyScenario("the-battle-of-lake-town");
const cardsOf = (state: ScenarioState, ...codes: string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));
const lakeDamage = (state: ScenarioState) => cardsOf(state, "50207")[0]?.damage ?? 0;

// A permanent golden: whole standalone games of The Battle of Lake-town played by the auto-player (test/scenarios/the-battle-of-lake-town/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and on Easy: each round a Smaug is revealed into the play area, the players travel, quest with one hero and
// attack him with the others; the quest goes a stage a round to The Dragon's Wrath, which Smaug's defeat ends with more Victory points in the victory display than damage on Lake-town (one win has the heroes take the Burn damage, 14 rounds, the other
// leaves it all on Lake-town). The losses are every player's threat at 50, every hero destroyed, 50 damage on Lake-town and Smaug defeated for too few points. Update the snapshot only when the change is meant.
describe("The Battle of Lake-town golden", () => {
  goldenSuite<TownGolden, TownDecks>({
    title: "The Battle of Lake-town",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: town,
    standalone: true,
    goldens: TOWN_GOLDENS,
    world: townWorld,
    play: playGolden,
    opening: {
      title: "starts at Terror from the Mountain with Lake-town and a card revealed for each player in the staging area, the 9 Smaug cards in the Smaug deck and the later stages in the quest deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50201");
        expect(["50202", "50203"].map((code) => cardsOf(state, code).map((card) => card.zone)), golden.name).toEqual([["questDeck"], ["questDeck"]]);
        // Lake-town is staged by the data and holds no damage but what the cards revealed in Setup put on it; no Smaug is in play before round 1 (their deck holds all nine).
        expect(cardsOf(state, "50207").map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, "50204", "50205", "50206").map((card) => card.zone), golden.name).toEqual(Array(9).fill("smaugDeck"));
        expect(state.piles?.smaugDiscard, golden.name).toEqual([]);
      },
    },
    wins: "ends when The Dragon's Wrath is defeated by Smaug's defeat with more Victory points than damage on Lake-town, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50203");
      expect(lakeDamage(state), golden.name).toBeLessThan(50);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason === "Lake-town holds 51 damage") expect(lakeDamage(state), golden.name).toBeGreaterThanOrEqual(50);
      else if (golden.lossReason?.startsWith("Smaug was defeated")) expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50203");
      else {
        expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
        // Two ways to be eliminated: the threat reached 50, or no hero is left.
        expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
      }
    },
  });
});

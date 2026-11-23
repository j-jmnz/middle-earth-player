// Rules: hob.setup-we-must-away-ere-break-of-day, hob.sack-deck, hob.sack-x, hob.bilbo-baggins-ohauh, rr.setup, rr.quest-advancement, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { DAY_GOLDENS, playGolden, dayWorld, type DayDecks, type DayGolden } from "../../../../test/scenarios/we-must-away-ere-break-of-day/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-hobbit");
const day = loadAnyScenario("we-must-away-ere-break-of-day");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const SACKS = ["131044", "131045", "131046", "131047", "131048", "131049", "131050"];
const TROLLS = ["131032", "131033", "131034"];

// A permanent golden: whole standalone games of We Must Away, Ere Break of Day played by the auto-player (test/scenarios/we-must-away-ere-break-of-day/game.ts) on fixed seeds, through two wins and each way to lose. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo on Easy and two-handed on Normal: the Trolls engage and attack, the players draw and attach their Sack cards, and the quest's progress discards run the encounter deck out (stage 2B advances the moment the deck is empty). The losses are every player's threat at 50
// and Bilbo Baggins destroyed (131001:A:3). The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("We Must Away, Ere Break of Day golden", () => {
  goldenSuite<DayGolden, DayDecks>({
    title: "We Must Away, Ere Break of Day",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: day,
    standalone: true,
    goldens: DAY_GOLDENS,
    world: dayWorld,
    play: playGolden,
    opening: {
      title: "starts at An Unexpected Party with the Sack cards in the Sack deck, the three Trolls and Troll Cave set aside, Bilbo Baggins in front of the first player's heroes",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("131023");
        expect(SACKS.map((code) => cardsOf(state, code).map((card) => card.zone)), golden.name).toEqual(SACKS.map(() => ["sackDeck"]));
        expect([...TROLLS, "131037"].map((code) => cardsOf(state, code).map((card) => card.zone)), golden.name).toEqual([...TROLLS, "131037"].map(() => ["setAside"]));
        expect(state.cards[state.seats[0]?.heroes[0] ?? ""]?.code, golden.name).toBe("131001");
      },
    },
    wins: "ends when stage 2B advances (no Troll enemy is left in play, or no card is left in the encounter deck) and Dawn Take You All is revealed, which wins at once; settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("131025");
      // Dawn Take You All removed every Troll and Sack card from the game.
      expect([...TROLLS, ...SACKS].every((code) => cardsOf(state, code).every((card) => card.zone === "removed")), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason === "Bilbo Baggins left play") {
        expect(cardsOf(state, "131001").every((card) => card.zone !== "heroes"), golden.name).toBe(true);
      } else {
        expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
        expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      }
    },
  });
});

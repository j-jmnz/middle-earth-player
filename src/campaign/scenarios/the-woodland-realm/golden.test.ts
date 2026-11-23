// Rules: rr.setup, rr.search, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, rr.ownership-and-control, ltp.scoring, docs/scenarios/standalone-scenarios/the-woodland-realm.md (The Woodland Realm) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { WOODLAND_GOLDENS, playGolden, woodlandWorld, type WoodlandDecks, type WoodlandGolden } from "../../../../test/scenarios/the-woodland-realm/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const woodland = loadAnyScenario("the-woodland-realm");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// A permanent golden: whole standalone games of The Woodland Realm played by the auto-player (test/scenarios/the-woodland-realm/game.ts) on fixed seeds, through wins with five pairs of stage cards and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed: the first player explores Spider Den, Mendor joins the players and the stage 3 card of the first
// player's choice is defeated. The losses are every player's threat at 50 (heroes too small to quest), every hero destroyed (brittle heroes) and Mendor leaving play. Update the snapshot only when the change is meant.
describe("The Woodland Realm golden", () => {
  goldenSuite<WoodlandGolden, WoodlandDecks>({
    title: "The Woodland Realm",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: woodland,
    standalone: true,
    goldens: WOODLAND_GOLDENS,
    world: woodlandWorld,
    play: playGolden,
    opening: {
      title: "opens on Captured by Spiders with Spider Den in the staging area, the encounter deck built from 7 of the 14 sets (35 cards) and the 3 stage cards of the first player's choice the only ones in the quest deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("51101");
        expect(codesOf(state, state.staging), golden.name).toContain("51110");
        // The first player has chosen one stage 2 and one stage 3 card; the other four wait out of the game. Mendor is not dealt: the flip of Spider Den brings him.
        expect(state.stages.map((stage) => stage.code), golden.name).toHaveLength(3);
        expect(state.stages[0]?.code, golden.name).toBe("51101");
        expect(Object.values(state.cards).some((card) => card.code === "51111" && card.zone === "play"), golden.name).toBe(false);
        // 7 sets of 5 cards (standalone.test.ts counts the sets), less the 0 cost enemy or location each player's Setup search added to the staging area.
        expect(state.encounterDeck.length, golden.name).toBe(35 - golden.seatCount);
        expect(state.staging, golden.name).toHaveLength(1 + golden.seatCount);
      },
    },
    wins: "wins when the stage 3 card of the first player's choice is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(["51107", "51108", "51109"], golden.name).toContain(state.cards[state.questStage ?? ""]?.code);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
      // Spider Den flipped into Mendor, who is still in play.
      expect(Object.values(state.cards).some((card) => card.code === "51111" && card.zone === "play"), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason === "Mendor left play") {
        expect(Object.values(state.cards).some((card) => card.code === "51111" && card.zone === "play"), golden.name).toBe(false);
        return;
      }
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

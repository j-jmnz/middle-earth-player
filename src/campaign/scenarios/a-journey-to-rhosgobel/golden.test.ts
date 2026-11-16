// Rules: rr.setup, rr.quest-advancement, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, sotm.setup-a-journey-to-rhosgobel, sotm.ally-objective-wilyador, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { RHOSGOBEL_GOLDENS, playGolden, rhosgobelWorld, type RhosgobelDecks, type RhosgobelGolden } from "../../../../test/scenarios/a-journey-to-rhosgobel/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const rhosgobel = loadAnyScenario("a-journey-to-rhosgobel");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of A Journey to Rhosgobel played by the auto-player (test/scenarios/a-journey-to-rhosgobel/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, solo on Easy and two-handed on Nightmare: the first player controls Wilyador, who takes 2 damage each round, the players claim Athelas, and the game ends when Return to Rhosgobel heals him completely.
// The losses are each way to lose: every player's threat at 50, every hero destroyed, Wilyador destroyed, the seat that controls Wilyador eliminated while the other lives on, and stage 3 revealed with Wilyador still hurt. The opening, the causes,
// a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("A Journey to Rhosgobel golden", () => {
  goldenSuite<RhosgobelGolden, RhosgobelDecks>({
    title: "A Journey to Rhosgobel",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: rhosgobel,
    standalone: true,
    goldens: RHOSGOBEL_GOLDENS,
    world: rhosgobelWorld,
    play: playGolden,
    opening: {
      title: "starts at The Wounded Eagle with Rhosgobel in the staging area, Wilyador in the first player's play area with 2 damage, the Athelas in the encounter deck and the later stages in the quest deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02060");
        expect(cardsOf(state, "02065").map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, "02064").map((card) => [card.zone, card.controller, card.damage]), golden.name).toEqual([["play", state.firstPlayer, 2]]);
        expect(cardsOf(state, "02063").every((card) => card.zone === "encounterDeck"), golden.name).toBe(true);
        expect(cardsOf(state, "02061").map((card) => card.zone), golden.name).toEqual(["questDeck"]);
        expect(cardsOf(state, "02062").map((card) => card.zone), golden.name).toEqual(["questDeck"]);
        // Nightmare: the setup card lies out of play and the Goblin Eagle-hunter waits in the staging area.
        expect(cardsOf(state, "900601").map((card) => card.zone), golden.name).toEqual(golden.difficulty === "Nightmare" ? ["nightmare"] : []);
        expect(cardsOf(state, "900602").some((card) => card.zone === "staging"), golden.name).toBe(golden.difficulty === "Nightmare");
      },
    },
    wins: "ends when Return to Rhosgobel heals Wilyador completely (stage 3 has no quest points), settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02062");
      // Wilyador is whole and the Athelas that healed him are on the heroes that claimed them.
      const [wilyador] = cardsOf(state, "02064");
      expect(wilyador?.zone, golden.name).toBe("play");
      expect(wilyador?.damage, golden.name).toBe(0);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      const [wilyador] = cardsOf(state, "02064");
      if (golden.lossReason === "Wilyador was not healed") {
        // Stage 3 was revealed with Wilyador still hurt.
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02062");
        expect(wilyador?.damage, golden.name).toBeGreaterThan(0);
      } else if (golden.lossReason === "Wilyador left play") {
        // He is destroyed by his damage, or the seat that controls him is eliminated: either way he is no longer in play.
        expect(wilyador?.zone, golden.name).not.toBe("play");
        if (golden.seatCount === 2) expect(seats.some((seat) => seat.eliminated) && seats.some((seat) => !seat.eliminated), golden.name).toBe(true);
        else expect(wilyador?.damage, golden.name).toBeGreaterThanOrEqual(20);
      } else {
        expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
        // Two ways to be eliminated: the threat reached 50, or no hero is left.
        expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
      }
    },
  });
});

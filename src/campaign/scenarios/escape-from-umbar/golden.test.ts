// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.engaged, hrd.setup-escape-from-umbar (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { UMBAR_GOLDENS, playGolden, umbarWorld, type UmbarDecks, type UmbarGolden } from "../../../../test/scenarios/escape-from-umbar/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const umbar = loadAnyScenario("escape-from-umbar");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Escape from Umbar played by the auto-player (test/scenarios/escape-from-umbar/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and Easy: the players clear the enemies engaged with them, take stage 1B's 15 progress and defeat stage 2B.
// The losses are the three ways to lose: "Seize Them!" (no progress on the main quest at the end of a round it was in play for the whole of), every player's threat at 50 and every hero destroyed. Update the snapshot only when the change is meant.
describe("Escape from Umbar golden", () => {
  goldenSuite<UmbarGolden, UmbarDecks>({
    title: "Escape from Umbar",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: umbar,
    standalone: true,
    goldens: UMBAR_GOLDENS,
    world: umbarWorld,
    play: playGolden,
    opening: {
      title: "starts on Stranded in Umbar (1A flipped to 1B by its Setup) with \"Seize Them!\" and one different location for each player in the staging area, one Umbar Sentry engaged with each player and the other locations in the encounter deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "16066", face: "B", zone: "questStage" });
        expect(cardsOf(state, "16014").map((card) => card.zone), golden.name).toEqual(["staging"]);
        // Each player adds 1 different location (an Umbar location of 16016 to 16020) to the staging area.
        const locations = ["16016", "16017", "16018", "16019", "16020"].flatMap((code) => cardsOf(state, code));
        expect(locations.filter((card) => card.zone === "staging"), golden.name).toHaveLength(golden.seatCount);
        expect(new Set(locations.filter((card) => card.zone === "staging").map((card) => card.code)).size, golden.name).toBe(golden.seatCount);
        expect(cardsOf(state, "16015").filter((card) => card.zone === "engaged"), golden.name).toHaveLength(golden.seatCount);
      },
    },
    wins: "ends when stage 2B (Flee the City) is defeated with no player engaged, settles at once with a score and earns nothing",
    won(state, golden) {
      // The game ended on the second stage: Stranded in Umbar went to the victory display and stage 2B was defeated.
      expect(cardsOf(state, "16067").map((card) => card.zone), golden.name).not.toContain("questDeck");
      expect(state.stageCleared, golden.name).toBe(true);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.decks === "tense") {
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      } else if (golden.decks === "brittle") {
        expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      } else {
        // "Seize Them!": the main quest has no progress and the players are alive.
        expect(state.lossReason, golden.name).toContain("The main quest held no progress");
        expect(seats.some((seat) => seat.threat < 50), golden.name).toBe(true);
      }
    },
  });
});

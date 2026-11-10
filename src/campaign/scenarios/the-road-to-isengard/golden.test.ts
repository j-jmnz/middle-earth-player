// Rules: mec112.wizardry, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { ISENGARD_GOLDENS, playGolden, isengardWorld, type IsengardDecks, type IsengardGolden } from "../../../../test/scenarios/the-road-to-isengard/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-two-towers");
const isengard = loadScenario("the-road-to-isengard");
const zonesOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
const SARUMAN = "143047";

// A permanent golden: whole games of The Road to Isengard in Campaign Mode played by the auto-player (test/scenarios/the-road-to-isengard/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy) and through
// the ways to lose that a game of stand-ins reaches (the players' threat at 50, every hero destroyed, a hand empty on stage 3B). It pins the path from data/ through the Campaign Setup Checklist and buildStart, stage 1B's end of round, the advance
// to stage 2A, the Wizardry locations, stage 2B's damage and the advance to 3A, the Staff and Saruman's gate and the win on 3B, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("The Road to Isengard golden", () => {
  goldenSuite<IsengardGolden, IsengardDecks>({
    title: "The Road to Isengard",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: isengard,
    goldens: ISENGARD_GOLDENS,
    world: isengardWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1B with the four Ents of Fangorn in the staging area, and Saruman, his Staff, Orthanc and the Gates of Isengard set aside",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("143078");
        expect(zonesOf(state, "143046"), golden.name).toEqual(["staging", "staging", "staging", "staging"]);
        for (const code of [SARUMAN, "143048", "143053", "143054"]) expect(zonesOf(state, code), golden.name).toEqual(["setAside"]);
      },
    },
    wins: "wins on stage 3B once Saruman has taken 6 damage and the stage is defeated, runs 143081's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("143080");
      // Saruman's gate (143048:A:2) is clear: his damage reached his 6 hit points, and no seat is eliminated.
      const saruman = Object.values(state.cards).find((card) => card.code === SARUMAN);
      expect(saruman?.damage, golden.name).toBeGreaterThanOrEqual(6);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy, each way to lose", () => {
        const won = ISENGARD_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        const lost = ISENGARD_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const decks of ["weak", "brittle"] as const) expect(lost.some((golden) => golden.decks === decks), decks).toBe(true);
        expect(lost.some((golden) => golden.policy?.engage === false)).toBe(true);
      });

      it("143048:A:2 a win has wounded Saruman through the attack at Orthanc, and the games that lose never defeat stage 3B", () => {
        for (const golden of ISENGARD_GOLDENS.filter((item) => item.outcome === "won")) {
          const played = game(golden);
          expect(played.state.stageCleared, golden.name).toBe(true);
          expect(played.steps.some((step) => step.kind === "advance"), golden.name).toBe(true);
        }
        for (const golden of ISENGARD_GOLDENS.filter((item) => item.outcome === "lost")) expect(game(golden).state.stageCleared, golden.name).toBeFalsy();
      });

      it("the players' threat reaches 50 in the weak games, and every hero is destroyed in the brittle ones", () => {
        for (const golden of ISENGARD_GOLDENS.filter((item) => item.decks === "weak")) {
          const state = game(golden).state;
          for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.threat, golden.name).toBeGreaterThanOrEqual(50);
        }
        for (const golden of ISENGARD_GOLDENS.filter((item) => item.decks === "brittle")) {
          const state = game(golden).state;
          for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.heroes.every((id) => state.cards[id]?.zone !== "heroes"), golden.name).toBe(true);
        }
      });

      it("143080:B:3 the games that never attack lose a player whose hand is empty on stage 3B, with a threat below 50", () => {
        for (const golden of ISENGARD_GOLDENS.filter((item) => item.policy?.engage === false)) {
          const state = game(golden).state;
          expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("143080");
          const emptied = state.seats.slice(0, golden.seatCount).filter((seat) => seat.eliminated && seat.hand.length === 0 && seat.threat < 50);
          expect(emptied.length, golden.name).toBeGreaterThanOrEqual(1);
        }
      });
    },
  });
});

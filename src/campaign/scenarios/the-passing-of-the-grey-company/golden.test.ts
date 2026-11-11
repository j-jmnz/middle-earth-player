// Rules: mec113.phantom, mec113.setting-up-the-game, mec113.saga-staging-rules, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.initial-threat-level (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { COMPANY_GOLDENS, playGolden, companyWorld, type CompanyDecks, type CompanyGolden } from "../../../../test/scenarios/the-passing-of-the-grey-company/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-return-of-the-king");
const company = loadScenario("the-passing-of-the-grey-company");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole games of The Passing of the Grey Company in Campaign Mode played by the auto-player (test/scenarios/the-passing-of-the-grey-company/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy, with
// the players engaging and defending too) and through the ways to lose that a game of stand-ins reaches (the players' threat at 50; no enemy of the scenario hurts a hero while it has Phantom). It pins the path from data/ through the Campaign Setup
// Checklist and buildStart (The Forbidden Door as stage 1, Aragorn the first player's hero, Andúril placed, an Overcome by Fear on each player's threat dial and the other copies removed, The Stone of Erech and Army of the Dead set aside), stage 1B's
// discard of the hands, stage 2's threat floor, stage 3 adding the Stone and the Army, and the win when the Stone leaves play explored, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("The Passing of the Grey Company golden", () => {
  goldenSuite<CompanyGolden, CompanyDecks>({
    title: "The Passing of the Grey Company",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: company,
    goldens: COMPANY_GOLDENS,
    world: companyWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1 with an Overcome by Fear on each player's threat dial, the other copies removed, The Stone of Erech and Army of the Dead set aside and Aragorn the first player's hero",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("145063");
        const fear = cardsOf(state, "145016");
        expect(fear.filter((card) => card.zone === "play").map((card) => card.controller).sort(), golden.name).toEqual(state.seats.slice(0, golden.seatCount).map((_, seat) => seat));
        expect(fear.filter((card) => card.zone === "setAside"), golden.name).toHaveLength(0);
        for (const code of ["145017", "145067"]) expect(cardsOf(state, code).map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(state.seats[state.firstPlayer]?.heroes.map((id) => state.cards[id]?.code), golden.name).toContain("145001");
      },
    },
    wins: "wins when The Stone of Erech leaves play explored, runs 145066's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("145065");
      expect(state.stageCleared, golden.name).toBe(true);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy, a threat loss and the loss of Aragorn", () => {
        const won = COMPANY_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        const lost = COMPANY_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.lossReason === "Aragorn left play")).toBe(true);
      });

      it("145065:B:2 a win has explored The Stone of Erech out of play, and stage 3B is still the current stage", () => {
        for (const golden of COMPANY_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(cardsOf(state, "145017").map((card) => card.zone), golden.name).toEqual(["encounterDiscard"]);
          expect(state.cards[state.questStage ?? ""]?.zone, golden.name).toBe("questStage");
        }
      });

      it("145063:A:1 every game starts with one Overcome by Fear on each dial and the other copies out of the game", () => {
        for (const golden of COMPANY_GOLDENS) {
          const state = game(golden).state;
          const copies = cardsOf(state, "145016");
          expect(copies, golden.name).toHaveLength(4);
          expect(copies.filter((card) => card.zone === "removed"), golden.name).toHaveLength(4 - golden.seatCount);
        }
      });
    },
  });
});

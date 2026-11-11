// Rules: mec113.setting-up-the-game, mec113.saga-staging-rules, mec113.army-of-the-dead, mec113.multiplayer-aragorn, mec113.campaign-mode, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, rr.travel (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { emptyLog } from "../../log.ts";

import { GONDOR_GOLDENS, afterCompany, playGolden, gondorWorld, type GondorDecks, type GondorGolden } from "../../../../test/scenarios/the-siege-of-gondor/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-return-of-the-king");
const gondor = loadScenario("the-siege-of-gondor");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const SHIPS = ["145031", "145032"];

// A permanent golden: whole games of The Siege of Gondor in Campaign Mode played by the auto-player (test/scenarios/the-siege-of-gondor/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy, after The Passing of the Grey
// Company with the Army of the Dead in play, the players engaging or answering The Corsair Fleet with its damage) and through the ways to lose that a game of stand-ins reaches (the players' threat at 50, every hero destroyed, Aragorn leaving play). It
// pins the path from data/ through the Campaign Setup Checklist and buildStart (Attack on Pelargir as the only stage, Great Corsair Ship and The Corsair Fleet in the staging area, each player's searched Ship location beside them, the Army of the Dead put
// into play under the first player when the pool holds it), the Fleet's resource and choice each staging step, the Ships explored into the victory display, the travel to Great Corsair Ship once 3 Ship locations are there and the win when it is explored
// with 20 or more progress on the stage, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("The Siege of Gondor golden", () => {
  goldenSuite<GondorGolden, GondorDecks>({
    title: "The Siege of Gondor",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: gondor,
    goldens: GONDOR_GOLDENS,
    world: gondorWorld,
    play: playGolden,
    opening: {
      title: "starts at Attack on Pelargir with Great Corsair Ship and The Corsair Fleet in the staging area, one searched Ship location for each player, and the Army of the Dead in play under the first player only when the pool holds it",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("145069");
        const staging = state.staging.map((id) => state.cards[id]?.code);
        expect(staging, golden.name).toEqual(expect.arrayContaining(["145030", "145071"]));
        expect(staging.filter((code) => SHIPS.includes(code ?? "")), golden.name).toHaveLength(golden.seatCount);
        const army = cardsOf(state, "145068");
        if (golden.after) {
          expect(army.map((card) => card.zone), golden.name).toEqual(["play"]);
          expect(army[0]?.controller, golden.name).toBe(state.firstPlayer);
        } else {
          expect(army, golden.name).toHaveLength(0);
        }
        expect(state.seats[state.firstPlayer]?.heroes.map((id) => state.cards[id]?.code), golden.name).toContain("145001");
      },
    },
    wins: "wins when Great Corsair Ship is explored with 20 or more progress on the stage, runs 145070's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("145069");
      expect(state.stageCleared, golden.name).toBe(true);
      expect(cardsOf(state, "145030").map((card) => card.zone), golden.name).toEqual(["victory"]);
      // The travel to Great Corsair Ship needed 3 Ship locations in the victory display.
      expect(Object.values(state.cards).filter((card) => card.zone === "victory" && SHIPS.includes(card.code)).length, golden.name).toBeGreaterThanOrEqual(3);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    // The log the Resolution is written onto: the Passing of the Grey Company done and, after it, the Army of the Dead boon in the pool.
    before: (golden) => (golden.after ? afterCompany(golden.seatCount) : emptyLog(golden.seatCount)),
    afterWin({ state, golden, log }) {
      // 145070:B:1: the resources on The Corsair Fleet are written in the log, and the Army of the Dead boon leaves the pool.
      const fleet = cardsOf(state, "145071")[0];
      expect(log.corsairFleet, golden.name).toBe(fleet?.resources ?? 0);
      expect(log.campaignPool.some((card) => card.code === "145068"), golden.name).toBe(false);
    },
    checks({ game, opened }) {
      it("covers the wins and losses it names: seats, Easy, the earlier part, the Fleet's damage, a threat loss and the loss of Aragorn", () => {
        const won = GONDOR_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.after).length).toBeGreaterThanOrEqual(2);
        const lost = GONDOR_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.lossReason === "Aragorn left play")).toBe(true);
      });

      it("145071:A:1 The Corsair Fleet gains a resource at the beginning of each staging step, so it holds at least one for each round played", () => {
        for (const golden of GONDOR_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(cardsOf(state, "145071")[0]?.resources ?? 0, golden.name).toBeGreaterThanOrEqual(state.round - 1);
        }
      });

      it("145068:A:3 the Army of the Dead is removed from the game when it leaves play, not discarded, and survives the games that never hurt it", () => {
        for (const golden of GONDOR_GOLDENS.filter((item) => item.after)) {
          const zones = cardsOf(game(golden).state, "145068").map((card) => card.zone);
          expect(zones, golden.name).toHaveLength(1);
          expect(["play", "removed"], golden.name).toContain(zones[0]);
        }
        expect(GONDOR_GOLDENS.filter((golden) => golden.after).some((golden) => cardsOf(game(golden).state, "145068")[0]?.zone === "removed")).toBe(true);
      });

      it("145069:A:1 every game starts with Great Corsair Ship, and a searched Ship location for each player", () => {
        for (const golden of GONDOR_GOLDENS) {
          const state = opened(golden);
          expect(state.staging.filter((id) => SHIPS.includes(state.cards[id]?.code ?? "")), golden.name).toHaveLength(golden.seatCount);
        }
      });
    },
  });
});

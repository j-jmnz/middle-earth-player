// Rules: mec108.setup-escape-from-mount-gram, mec108.captured-deck, mec108.captured-cards, mec108.capture-x, mec108.create-staging-area, mec108.joining-another-player, mec108.side-quests, mec108.campaign-log, rr.winning-the-game, rr.campaign-pool, rr.player-elimination (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { capturedDeck, capturedUnder } from "../../../rules/families/captured/pile.ts";

import { GRAM_GOLDENS, playGolden, gramWorld, type GramDecks, type GramGolden } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("angmar-awakened");
const gram = loadScenario("escape-from-mount-gram");
const LOOT = "10175";
const SOUTHERN_GATE = "10042";
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);

// A permanent golden: whole games of Escape from Mount Gram in Campaign Mode played by the auto-player (test/scenarios/escape-from-mount-gram/game.ts) on fixed seeds, true solo and two-handed, through wins (the heroes quest with everything, rescue the captured cards of stage 2B at once and advance
// to stage 3A together; the win defeats stage 3B once Southern Gate is explored) and the ways to lose (the players' threat at 50, the hero destroyed). It pins the path from data/ through the quest card's Setup (a captured deck of each player's allies, Items and other heroes, the starting hero with 2
// resources and its threat cost as the dial, a new hand of 3), the campaign card's Setup (Loot the Dungeons staged in every area with the bottom 5 of each captured deck underneath it) and stage 2A (Capture 7, a Prison Cell with 3 captured cards, a staging area of each player's own). Update the snapshot only when the change is meant.
describe("Escape from Mount Gram golden", () => {
  goldenSuite<GramGolden, GramDecks>({
    title: "Escape from Mount Gram",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: gram,
    goldens: GRAM_GOLDENS,
    world: gramWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 2A of each player with a staging area of their own, a Prison Cell holding 3 cards in each, 7 cards captured under each stage and Loot the Dungeons holding each player's bottom 5",
      check(state, golden) {
        expect(state.separate, golden.name).toBe(true);
        const seats = state.seats.slice(0, golden.seatCount);
        expect(new Set(seats.map((seat) => seat.stage)).size, golden.name).toBe(golden.seatCount);
        for (const seat of seats) {
          expect(state.cards[seat.stage ?? ""]?.code, golden.name).toBe("10039");
          expect(capturedUnder(state, seat.stage ?? ""), golden.name).toHaveLength(7);
          const cell = seat.staging.find((id) => state.cards[id]?.code === "10046");
          expect(cell, golden.name).toBeTruthy();
          expect(capturedUnder(state, cell ?? ""), golden.name).toHaveLength(3);
          expect(seat.heroes, golden.name).toHaveLength(1);
        }
        // Loot the Dungeons is one card in no player's area, holding the bottom 5 of each captured deck.
        const loot = cardsOf(state, LOOT);
        expect(loot.map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(capturedUnder(state, loot[0]?.id ?? ""), golden.name).toHaveLength(5 * golden.seatCount);
        expect(state.sideQuests, golden.name).toBe(true);
      },
    },
    wins: "wins when stage 3B is defeated with Southern Gate explored, runs 10174's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10040");
      expect(zonesOf(state, SOUTHERN_GATE), golden.name).toEqual(["victory"]);
      // A player whose heroes were all destroyed is out of the game; the other player wins it.
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(seat.heroes.length === 0);
    },
    afterWin({ state, golden, log }) {
      // 10174:B:3: the unique cards still in each captured deck are noted as stolen, by seat, and no other card is.
      expect(log.completed, golden.name).toContain("escape-from-mount-gram");
      for (const [seat, codes] of log.stolenCards.slice(0, golden.seatCount).entries()) {
        const still = capturedDeck(state, seat).map((id) => state.cards[id]?.code);
        for (const code of codes) expect(still, `${golden.name} seat ${seat}`).toContain(code);
      }
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy and each way to lose", () => {
        const won = GRAM_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(1);
        expect(won.some((golden) => golden.difficulty === "Easy")).toBe(true);
        const lost = GRAM_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak" && golden.seatCount === 1)).toBe(true);
        expect(lost.some((golden) => golden.decks === "weak" && golden.seatCount === 2)).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("rr.player-elimination the won game in which a player's heroes were destroyed eliminated that player and the other player won it", () => {
        const golden = GRAM_GOLDENS.find((item) => item.decks === "brittle" && item.outcome === "won")!;
        const state = game(golden).state;
        const bare = state.seats.slice(0, golden.seatCount).filter((seat) => seat.heroes.length === 0);
        expect(bare.length).toBe(1);
        expect(bare[0]?.eliminated).toBe(true);
      });

      it("10040:B:2 each won game explored Southern Gate with 16 or more progress on the stage, and the lost games never revealed stage 3A's win", () => {
        for (const golden of GRAM_GOLDENS) {
          const state = game(golden).state;
          const defeated = zonesOf(state, SOUTHERN_GATE).includes("victory");
          expect(defeated, golden.name).toBe(golden.outcome === "won");
          if (defeated) expect(state.cards[state.questStage ?? ""]?.progress, golden.name).toBeGreaterThanOrEqual(16);
        }
      });

      it("10038:A:1 and 10174:B:1 the game lost on threat raised the player's threat to 50, a player whose hero died stays in the game until then", () => {
        const brittle = GRAM_GOLDENS.find((golden) => golden.decks === "brittle" && golden.outcome === "lost")!;
        const state = game(brittle).state;
        expect(state.seats[0]?.heroes).toHaveLength(0);
        expect(state.seats[0]?.threat).toBeGreaterThanOrEqual(50);
        const weak = GRAM_GOLDENS.find((golden) => golden.decks === "weak")!;
        expect(game(weak).state.seats[0]?.threat).toBeGreaterThanOrEqual(50);
      });
    },
  });
});

// Rules: mec112.mire, mec112.gollum-smeagol, mec112.setting-up-the-game, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { MARSHES_GOLDENS, playGolden, marshesWorld, type MarshesDecks, type MarshesGolden } from "../../../../test/scenarios/the-passage-of-the-marshes/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-two-towers");
const marshes = loadScenario("the-passage-of-the-marshes");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const MIRE = ["144019", "144020", "144021", "144022", "144023"];
const cardsOfGame = (state: ScenarioState) => Object.values(state.cards).filter((card) => MIRE.includes(card.code));

// A permanent golden: whole games of The Passage of the Marshes in Campaign Mode played by the auto-player (test/scenarios/the-passage-of-the-marshes/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy)
// and through the ways to lose that a game of stand-ins reaches (the players' threat at 50, every hero destroyed). It pins the path from data/ through the Campaign Setup Checklist (the Ring-bearer with The One Ring, a Searching Eye in each
// deck) and buildStart, Gollum engaged with the first player, the Mire step of each refresh phase and the locations it discards, the flip of Gollum to Sméagol and the gate on the first player's Sméagol, the explored locations of stage
// 2B, the Undead of stage 3A and the win on 3B, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("The Passage of the Marshes golden", () => {
  goldenSuite<MarshesGolden, MarshesDecks>({
    title: "The Passage of the Marshes",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: marshes,
    goldens: MARSHES_GOLDENS,
    world: marshesWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1B with Gollum engaged with the first player, one location of each player's search in the staging area and The One Ring on the Ring-bearer",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("144064");
        const gollum = cardsOf(state, "144075");
        expect(gollum.map((card) => card.zone), golden.name).toEqual(["engaged"]);
        expect(gollum[0]?.controller, golden.name).toBe(state.firstPlayer);
        const locations = state.staging.filter((id) => ["144019", "144020", "144021", "144022", "144023"].includes(state.cards[id]?.code ?? ""));
        expect(locations.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
        const ring = cardsOf(state, "144063")[0];
        expect(ring?.zone, golden.name).toBe("play");
        expect(ring?.host && state.cards[ring.host]?.code, golden.name).toBe("141001");
      },
    },
    wins: "wins on stage 3B with the first player controlling Sméagol, runs 144067's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("144066");
      // The gate on the last stage (144066:B:2): Sméagol is in play, controlled by the first player; no seat is eliminated.
      const smeagol = cardsOf(state, "144076")[0];
      expect(smeagol?.zone, golden.name).toBe("play");
      expect(smeagol?.controller, golden.name).toBe(state.firstPlayer);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy, each way to lose", () => {
        const won = MARSHES_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        const lost = MARSHES_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const decks of ["weak", "brittle"] as const) expect(lost.some((golden) => golden.decks === decks), decks).toBe(true);
      });

      it("144064:B:1 the win comes after Gollum was defeated and flipped to Sméagol, who stays the first player's", () => {
        for (const golden of MARSHES_GOLDENS.filter((item) => item.outcome === "won")) {
          const played = game(golden);
          expect(played.steps.some((step) => step.kind === "advance"), golden.name).toBe(true);
          expect(cardsOf(played.state, "144076").length, golden.name).toBe(1);
          expect(cardsOf(played.state, "144075").length, golden.name).toBe(0);
        }
      });

      it("144065:B:2 a win passes stage 2B (4 locations were in the victory display), and a location was discarded by Mire into the encounter discard pile in some game", () => {
        for (const golden of MARSHES_GOLDENS.filter((item) => item.outcome === "won")) {
          const played = game(golden);
          expect(played.steps.filter((step) => step.kind === "advance").length, golden.name).toBeGreaterThanOrEqual(2);
        }
        const mired = MARSHES_GOLDENS.some((golden) => cardsOfGame(game(golden).state).some((card) => card.zone === "encounterDiscard"));
        expect(mired).toBe(true);
      });

      it("the players' threat reaches 50 in the weak games, and every hero is destroyed in the brittle ones", () => {
        for (const golden of MARSHES_GOLDENS.filter((item) => item.decks === "weak")) {
          const state = game(golden).state;
          expect(state.seats.slice(0, golden.seatCount).some((seat) => seat.threat >= 50), golden.name).toBe(true);
        }
        for (const golden of MARSHES_GOLDENS.filter((item) => item.decks === "brittle")) {
          const state = game(golden).state;
          for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.heroes.every((id) => state.cards[id]?.zone !== "heroes"), golden.name).toBe(true);
        }
      });
    },
  });
});

// Rules: mec112.setup-journey-to-the-cross-roads, mec112.setting-up-the-game, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.campaign-setup-checklist, rr.travel (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { ROADS_GOLDENS, playGolden, roadsWorld, type RoadsDecks, type RoadsGolden } from "../../../../test/scenarios/journey-to-the-cross-roads/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-two-towers");
const roads = loadScenario("journey-to-the-cross-roads");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const HARAD = ["144056", "144057", "144058"];
const HARAD_DECK_SIZE = 9;

// A permanent golden: whole games of Journey to the Cross-roads in Campaign Mode played by the auto-player (test/scenarios/journey-to-the-cross-roads/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy)
// and through the ways to lose that a game of stand-ins reaches (the Harad enemies under The Black Gate, the players' threat at 50, every hero destroyed, the Ring-bearer's seat eliminated). It pins the path from data/ through the
// Campaign Setup Checklist (the Ring-bearer with The One Ring, the players' choice of resources or Brace of Coneys) and buildStart, The Black Gate and The Cross-roads in the staging area with the Men of Harad under the Cross-roads,
// the Harad deck revealed one card a quest phase and by the travel costs, the enemies placed under the Gate, and the win when The Cross-roads is explored with the deck empty, so a change that moves any of them fails here.
// Update the snapshot only when the change is meant.
describe("Journey to the Cross-roads golden", () => {
  goldenSuite<RoadsGolden, RoadsDecks>({
    title: "Journey to the Cross-roads",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: roads,
    goldens: ROADS_GOLDENS,
    world: roadsWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1B with The Black Gate and The Cross-roads in the staging area, the Men of Harad under The Cross-roads, The One Ring on the Ring-bearer and no card under the Gate",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("144068");
        const staging = state.staging.map((id) => state.cards[id]?.code);
        expect(staging, golden.name).toContain("144027");
        expect(staging, golden.name).toContain("144030");
        const deck = state.piles?.haradDeck ?? [];
        expect(deck, golden.name).toHaveLength(HARAD_DECK_SIZE);
        expect(deck.every((id) => HARAD.includes(state.cards[id]?.code ?? "")), golden.name).toBe(true);
        expect(Object.values(state.cards).filter((card) => card.zone === "under"), golden.name).toHaveLength(0);
        const ring = cardsOf(state, "144063")[0];
        expect(ring?.zone, golden.name).toBe("play");
        expect(ring?.host && state.cards[ring.host]?.code, golden.name).toBe("141001");
      },
    },
    wins: "wins when The Cross-roads is explored with the Harad deck empty and 20 progress on the stage, runs 144069's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("144068");
      expect(state.piles?.haradDeck ?? [], golden.name).toHaveLength(0);
      expect(cardsOf(state, "144030")[0]?.zone, golden.name).not.toBe("staging");
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy, each way to lose", () => {
        const won = ROADS_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        const lost = ROADS_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const decks of ["strong", "weak", "brittle"] as const) expect(lost.some((golden) => golden.decks === decks), decks).toBe(true);
        for (const seatCount of [1, 2] as const) expect(lost.some((golden) => golden.seatCount === seatCount && golden.decks === "strong"), `${seatCount} seats under the Gate`).toBe(true);
      });

      it("144068:B:1 a Harad card is revealed from under The Cross-roads each quest phase until the deck is empty, and the wins play it out", () => {
        for (const golden of ROADS_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          const arrived = Object.values(state.cards).filter((card) => HARAD.includes(card.code));
          expect(arrived.length, golden.name).toBe(HARAD_DECK_SIZE);
          expect(arrived.every((card) => card.zone !== "haradDeck"), golden.name).toBe(true);
        }
      });

      it("144027:A:2 the Harad enemies under The Black Gate lose the game at players + 3 in the losing games of strong heroes, and never in the wins", () => {
        for (const golden of ROADS_GOLDENS.filter((item) => item.decks === "strong")) {
          const state = game(golden).state;
          expect(Object.values(state.cards).filter((card) => card.zone === "under").length, golden.name).toBe(golden.seatCount + 3);
        }
        for (const golden of ROADS_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(Object.values(state.cards).filter((card) => card.zone === "under").length, golden.name).toBeLessThan(golden.seatCount + 3);
        }
      });

      it("144030:A:2 the players travel to The Cross-roads only with no card under it and 20 progress on the stage", () => {
        for (const golden of ROADS_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          const stage = state.questStage ? state.cards[state.questStage] : undefined;
          expect(stage?.progress ?? 0, golden.name).toBeGreaterThanOrEqual(20);
        }
      });

      it("the players' threat reaches 50 in the weak games, and every hero is destroyed in the brittle ones", () => {
        for (const golden of ROADS_GOLDENS.filter((item) => item.decks === "weak")) {
          const state = game(golden).state;
          expect(state.seats.slice(0, golden.seatCount).some((seat) => seat.threat >= 50), golden.name).toBe(true);
        }
        for (const golden of ROADS_GOLDENS.filter((item) => item.decks === "brittle")) {
          const state = game(golden).state;
          expect(state.lost, golden.name).toBe(true);
        }
      });
    },
  });
});

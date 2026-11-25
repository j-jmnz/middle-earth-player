// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.guarded, rr.objective-cards, rm.time-x, rm.hinder (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { FANGORN_GOLDENS, playGolden, fangornWorld, type FangornDecks, type FangornGolden } from "../../../../test/scenarios/into-fangorn/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const fangorn = loadAnyScenario("into-fangorn");

const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Into Fangorn played by the auto-player (test/scenarios/into-fangorn/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal and Easy: a hero claims Mugash from Edge of Fangorn once it is explored, and the players defeat Escape from Fangorn (stage 2) with Mugash on a hero; the Easy wins run the Time out first (stage 3, then back to stage 2).
// The losses are the two ways to lose here, each solo and two-handed: every player's threat reaches 50 (heroes too weak) and every hero destroyed (heroes too brittle). Update the snapshot only when the change is meant.
describe("Into Fangorn golden", () => {
  goldenSuite<FangornGolden, FangornDecks>({
    title: "Into Fangorn",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: fangorn,
    standalone: true,
    goldens: FANGORN_GOLDENS,
    world: fangornWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with 4 time counters on it and stages 2 and 3 waiting, Edge of Fangorn in the staging area with Mugash attached, and one encounter card revealed for each player but the last",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("07065");
        expect(state.questDeck.map((id) => codeOf(state, id)).sort(), golden.name).toEqual(["07066", "07067"]);
        expect(state.cards[state.questStage ?? ""]?.resources, golden.name).toBe(4);
        const edge = cardsOf(state, "07032")[0];
        expect(edge?.zone, golden.name).toBe("staging");
        expect(cardsOf(state, "07031").map((card) => card.zone), golden.name).toEqual(["attached"]);
        expect(edge?.attachments, golden.name).toContain(cardsOf(state, "07031")[0]?.id);
      },
    },
    wins: "ends when Escape from Fangorn (stage 2) is defeated with Mugash on a hero (stage 3 cannot win), settles at once with a score and earns nothing",
    won(state, golden) {
      // Stage 2 holds the win: it stays the current quest card, defeated.
      expect(codeOf(state, state.questStage), golden.name).toBe("07066");
      const stage = state.cards[state.questStage ?? ""];
      expect(stage?.progress, golden.name).toBeGreaterThanOrEqual(12);
      const mugash = cardsOf(state, "07031")[0];
      expect(mugash?.zone, golden.name).toBe("attached");
      expect(codeOf(state, mugash?.host), golden.name).toBeTruthy();
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      if (golden.decks === "brittle") expect(seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

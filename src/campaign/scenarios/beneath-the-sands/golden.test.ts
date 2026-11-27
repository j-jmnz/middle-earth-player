// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, hrd.setup-beneath-the-sands, hrd.search-objective, hrd.track (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { SANDS_GOLDENS, playGolden, sandsWorld, type SandsDecks, type SandsGolden } from "../../../../test/scenarios/beneath-the-sands/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const sands = loadAnyScenario("beneath-the-sands");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Beneath the Sands played by the auto-player (test/scenarios/beneath-the-sands/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and true solo on Easy: the players turn the Search objective On Track with Track locations,
// work through the three stages and defeat stage 3B. The losses are the two ways to lose, every player at a threat of 50 (Off Track and its threat option wear the players down) and every hero destroyed; the scenario prints
// no loss of its own, so both end on the engine's "No seats remain". Update the snapshot only when the change is meant.
describe("Beneath the Sands golden", () => {
  goldenSuite<SandsGolden, SandsDecks>({
    title: "Beneath the Sands",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: sands,
    standalone: true,
    goldens: SANDS_GOLDENS,
    world: sandsWorld,
    play: playGolden,
    opening: {
      title: "starts on Searching the Caves (1A flipped to 1B by its Setup) with the Search objective Off Track in the staging area, Brood Mother set aside and the rest of the encounter deck dealt",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "17076", face: "B", zone: "questStage" });
        expect(cardsOf(state, "17079").map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, "17065").map((card) => card.zone), golden.name).toEqual(["setAside"]);
      },
    },
    wins: "ends when stage 3B (The Spiders' Hive) is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.stageCleared, golden.name).toBe(true);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Every hero destroyed leaves the threat under 50; the threat losses end with every seat at 50 or more.
      if (golden.decks === "brittle") expect(seats.some((seat) => seat.threat < 50), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
    },
    // Grabbed by Spiders has Limit 1 per quest: a copy revealed while another is attached is discarded, never attached or left in the staging area. Read from the states the one play kept (playGolden, trail). The last state of a
    // game lost in the middle of the reveal is the one exception (the players are out before the effect runs).
    checks({ game }) {
      it("a second Grabbed by Spiders is discarded: one is attached at most and none stays in the staging area", () => {
        let doubleReveals = 0;
        for (const golden of SANDS_GOLDENS) {
          const played = game(golden);
          const trail = played.trail ?? [];
          expect(trail.length, golden.name).toBe(played.intents.length);
          trail.forEach((state, at) => {
            // A reveal while a copy is attached: a copy comes to the discard pile in this intent and the attached one is still attached.
            const before = trail[at - 1];
            const attachedBefore = before ? cardsOf(before, "17074").filter((card) => card.zone === "attached").map((card) => card.id) : [];
            const newlyDiscarded = cardsOf(state, "17074").filter((card) => card.zone === "encounterDiscard" && !attachedBefore.includes(card.id) && before?.cards[card.id]?.zone !== "encounterDiscard");
            if (attachedBefore.length > 0 && newlyDiscarded.length > 0 && attachedBefore.every((id) => state.cards[id]?.zone === "attached")) doubleReveals += 1;
            if (state.lost && at === trail.length - 1) return;
            const copies = cardsOf(state, "17074");
            expect(copies.filter((card) => card.zone === "attached").length, `${golden.name} after intent ${at}`).toBeLessThanOrEqual(1);
            expect(copies.filter((card) => card.zone === "staging").length, `${golden.name} after intent ${at}`).toBe(0);
          });
        }
        // The goldens reveal a second copy while one is attached: the check sees the Limit work.
        expect(doubleReveals).toBeGreaterThan(0);
      });
      // The one loss only a two-handed game reaches: one seat is out (its heroes destroyed) while the other plays on, and the game is lost when the last seat falls.
      it("a two-handed loss has one seat eliminated while the other plays on", () => {
        const golden = SANDS_GOLDENS.find((item) => item.name.includes("while the other plays on"));
        expect(golden).toBeDefined();
        const trail = game(golden as SandsGolden).trail ?? [];
        expect(trail.some((state) => !state.lost && state.seats.slice(0, 2).filter((seat) => seat.eliminated).length === 1)).toBe(true);
      });
    },
  });
});

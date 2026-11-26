// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rm.parallel-stages, rm.time-x (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { EILPH_GOLDENS, playGolden, eilphWorld, type EilphDecks, type EilphGolden } from "../../../../test/scenarios/the-nin-in-eilph/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const eilph = loadAnyScenario("the-nin-in-eilph");

const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const STAGES_1 = ["08095", "08096", "08097"];

// A permanent golden: whole standalone games of The Nîn-in-Eilph played by the auto-player (test/scenarios/the-nin-in-eilph/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned, and Easy mode adds no game. The wins are true solo and two-handed: stage 1B picks a random stage 2, the Time of a stage 2 or 3 runs out and a different stage of
// its number replaces it, and the game ends when Ancient Marsh-dweller is defeated on stage 4. The losses are the two ways to lose here: a threat at the elimination level and Nalir leaving play. Update the snapshot only when the change is meant.
describe("The Nîn-in-Eilph golden", () => {
  goldenSuite<EilphGolden, EilphDecks>({
    title: "The Nîn-in-Eilph",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: eilph,
    standalone: true,
    goldens: EILPH_GOLDENS,
    world: eilphWorld,
    play: playGolden,
    opening: {
      title: "starts with the Setup played: a stage 2 chosen at random in play, Nalir under the first player's control, Ancient Marsh-dweller set aside, and one searched location in the staging area for each player",
      check(state, golden) {
        expect(STAGES_1, golden.name).toContain(state.cards[state.questStage ?? ""]?.code);
        const nalir = cardsOf(state, "08102");
        expect(nalir.map((card) => card.zone), golden.name).toEqual(["play"]);
        expect(nalir[0]?.controller, golden.name).toBe(state.firstPlayer);
        expect(cardsOf(state, "08103").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        const locations = state.staging.map((id) => state.cards[id]?.code).filter((code) => ["08106", "08107", "08108", "08109"].includes(code ?? ""));
        expect(locations.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
      },
    },
    wins: "ends when Ancient Marsh-dweller is defeated on stage 4B, and settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("08101");
      // The Marsh-dweller was defeated: it lies in the victory display.
      const marsh = cardsOf(state, "08103");
      expect(marsh, golden.name).toHaveLength(1);
      expect(marsh[0]?.zone, golden.name).toBe("victory");
      expect(cardsOf(state, "08102").map((card) => card.zone), golden.name).toEqual(["play"]);
      expect(state.seats.slice(0, golden.seatCount).every((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      if (golden.lossReason === "Nalir left play") expect(cardsOf(state, "08102").every((card) => card.zone !== "play"), golden.name).toBe(true);
      else expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.eliminated), golden.name).toBe(true);
    },
  });
});

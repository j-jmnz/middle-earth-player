// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rm.threat-elimination-level, rm.attacks-against-nalir, rm.time-x (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { THARBAD_GOLDENS, playGolden, tharbadWorld, type TharbadDecks, type TharbadGolden } from "../../../../test/scenarios/trouble-in-tharbad/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const tharbad = loadAnyScenario("trouble-in-tharbad");

const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Trouble in Tharbad played by the auto-player (test/scenarios/trouble-in-tharbad/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and Easy: the players quest on stage 1B (the Mug first, the excess lowers threat), advance when every threat is 0 and
// win when the progress that stage 2B redirects explores The Crossing at Tharbad. The losses are the two ways to lose here: a threat at the elimination level (lowered by stage 1B's Time) and Nalir leaving play. Update the snapshot only when the change is meant.
describe("Trouble in Tharbad golden", () => {
  goldenSuite<TharbadGolden, TharbadDecks>({
    title: "Trouble in Tharbad",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: tharbad,
    standalone: true,
    goldens: THARBAD_GOLDENS,
    world: tharbadWorld,
    play: playGolden,
    opening: {
      title: "starts with the Setup played: stage 1B in play, The Empty Mug active, Nalir under the first player's control, Bellach and The Crossing at Tharbad set aside, and one Spy From Mordor for each player in the staging area",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("08066");
        expect(codeOf(state, state.activeLocation), golden.name).toBe("08069");
        const nalir = cardsOf(state, "08068");
        expect(nalir.map((card) => card.zone), golden.name).toEqual(["play"]);
        expect(nalir[0]?.controller, golden.name).toBe(state.firstPlayer);
        expect(cardsOf(state, "08070").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(cardsOf(state, "08071").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(cardsOf(state, "08072").filter((card) => card.zone === "staging").length, golden.name).toBe(golden.seatCount);
      },
    },
    wins: "ends when the last progress explores The Crossing at Tharbad in the staging area on stage 2B, and settles at once with a score and earns nothing",
    won(state, golden) {
      expect(codeOf(state, state.questStage), golden.name).toBe("08067");
      expect(cardsOf(state, "08071").map((card) => card.zone), golden.name).not.toContain("setAside");
      const nalir = cardsOf(state, "08068");
      expect(nalir.map((card) => card.zone), golden.name).toEqual(["play"]);
      expect(state.seats.slice(0, golden.seatCount).every((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      if (golden.lossReason === "Nalir left play") expect(cardsOf(state, "08068").every((card) => card.zone !== "play"), golden.name).toBe(true);
      else expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.eliminated), golden.name).toBe(true);
    },
  });
});

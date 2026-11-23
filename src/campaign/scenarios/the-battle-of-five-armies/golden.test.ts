// Rules: rr.setup, rr.first-player, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, hob.multiple-stages-in-play, hob.current-quest-stage, hob.bilbo-baggins-otd, hob.battle, hob.siege, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { ARMIES_GOLDENS, BILBO, playGolden, armiesWorld, type ArmiesDecks, type ArmiesGolden } from "../../../../test/scenarios/the-battle-of-five-armies/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-hobbit");
const armies = loadAnyScenario("the-battle-of-five-armies");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Battle of Five Armies played by the auto-player (test/scenarios/the-battle-of-five-armies/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are two-handed on Normal and Easy: the first player chooses each round the stage with room left, the three stages are complete together and the players advance to stage 5, where Bolg is engaged with the first player, a Bodyguard of Bolg is
// destroyed first and then Bolg himself. The losses are the two ways to lose, true solo or two-handed: every player's threat at 50 and Bilbo Baggins leaving play. No true solo win: no seed in 16 (1 to 8, Normal and Easy) gets past the staging area of stage 5. The opening, the causes, a replay and
// the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Battle of Five Armies golden", () => {
  goldenSuite<ArmiesGolden, ArmiesDecks>({
    title: "The Battle of Five Armies",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: armies,
    standalone: true,
    goldens: ARMIES_GOLDENS,
    world: armiesWorld,
    play: playGolden,
    opening: {
      title: "starts with stages 2, 3 and 4 in play together and stage 2 the current stage, Bilbo Baggins in front of the first seat's heroes, Bolg in the staging area and a card revealed for each player",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("132076");
        expect((state.armies?.stages ?? []).map((id) => state.cards[id]?.code), golden.name).toEqual(["132076", "132077", "132078"]);
        expect(cardsOf(state, "132075").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(state.seats[0]?.heroes.map((id) => state.cards[id]?.code)[0], golden.name).toBe(BILBO);
        expect(cardsOf(state, "132053").map((card) => card.zone), golden.name).toEqual(["staging"]);
        const staged = Object.values(state.cards).filter((card) => card.zone === "staging" || card.zone === "encounterDiscard" || card.zone === "engaged");
        expect(staged.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount + 1);
      },
    },
    wins: "ends when Bolg is destroyed at stage 5, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("132079");
      expect(cardsOf(state, "132053").map((card) => card.zone), golden.name).toEqual(["encounterDiscard"]);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason === "Bilbo Baggins left play") return expect(cardsOf(state, BILBO).every((card) => card.zone !== "heroes"), golden.name).toBe(true);
      expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
    },
  });
});

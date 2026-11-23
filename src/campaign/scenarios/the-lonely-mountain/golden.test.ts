// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, hob.burgle, hob.bilbo-baggins-otd, hob.bilbo-multiplayer-otd, ltp.scoring, docs/scenarios/the-hobbit.md (The Lonely Mountain) (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { MOUNTAIN_GOLDENS, playGolden, mountainWorld, type MountainDecks, type MountainGolden } from "../../../../test/scenarios/the-lonely-mountain/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-hobbit");
const mountain = loadAnyScenario("the-lonely-mountain");
const cardsOf = (state: ScenarioState, ...codes: string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));

// A permanent golden: whole standalone games of The Lonely Mountain played by the auto-player (test/scenarios/the-lonely-mountain/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The first seat holds Bilbo Baggins (the loadout deals him), the others are the stand-in heroes. Each win plays stage 1 (the quest phase skipped), stage 2B (a quest success, 1 progress on Smaug
// the Golden and a burgle attempt, the players advancing to stage 3) and stage 3, which wins once the progress is above Smaug the Magnificent's remaining hit points. The losses are every player's threat at 50 (the heroes cannot quest) and Bilbo leaving play. Update the snapshot only when the change is meant.
describe("The Lonely Mountain golden", () => {
  goldenSuite<MountainGolden, MountainDecks>({
    title: "The Lonely Mountain",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: mountain,
    standalone: true,
    goldens: MOUNTAIN_GOLDENS,
    world: mountainWorld,
    play: playGolden,
    opening: {
      title: "starts at A Warm Welcome with Smaug the Golden and The Lonely Mountain in the staging area, the five Erebor treasures facedown under the Mountain, Smaug the Magnificent and A Bare Patch set aside, and Bilbo Baggins in the first seat",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("132071");
        expect(["132072", "132073", "132074"].map((code) => cardsOf(state, code).map((card) => card.zone)), golden.name).toEqual([["questDeck"], ["questDeck"], ["questDeck"]]);
        expect(cardsOf(state, "132040", "132043").map((card) => card.zone), golden.name).toEqual(["staging", "staging"]);
        expect(cardsOf(state, "132041", "132039").map((card) => card.zone), golden.name).toEqual(["setAside", "setAside"]);
        expect(cardsOf(state, "132020", "132021", "132022", "132023", "132024").map((card) => card.zone), golden.name).toEqual(Array(5).fill("under"));
        expect(cardsOf(state, "132001").map((card) => [card.zone, card.controller]), golden.name).toEqual([["heroes", 0]]);
        expect(state.seats[0]?.heroes[0], golden.name).toBe(cardsOf(state, "132001")[0]?.id);
        // Easy deals 2 Fighting Among Friends and 1 Weighed Down fewer (the Easy Mode sheet): 0 and 1 of the 2 and 2 Normal deals.
        expect(cardsOf(state, "132037", "132038").map((card) => card.code).sort(), golden.name).toEqual(golden.difficulty === "Easy" ? ["132038"] : ["132037", "132037", "132038", "132038"]);
      },
    },
    wins: "ends when stage 3 is defeated after Smaug the Magnificent is set aside, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("132073");
      expect(cardsOf(state, "132041").map((card) => card.zone), golden.name).toEqual(["setAside"]);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      if (golden.lossReason === "Bilbo Baggins left play") expect(cardsOf(state, "132001").every((card) => card.zone !== "heroes"), golden.name).toBe(true);
      else expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
    },
    checks(suite) {
      // Stage 2B's burgle attempt is made in each win, and it discards at least the encounter card with the burgle effect (nothing is revealed, so the staging area holds no card an attempt dealt).
      it("each win makes stage 2B's burgle attempt, which discards the encounter cards it deals and reveals none", () => {
        for (const golden of MOUNTAIN_GOLDENS.filter((item) => item.outcome === "won")) {
          const game = suite.game(golden);
          const attempts = game.steps.filter((step) => step.kind === "burgle");
          expect(attempts.length, golden.name).toBeGreaterThanOrEqual(1);
          for (const step of attempts) {
            if (step.kind !== "burgle") continue;
            expect(step.dealtIds.length, golden.name).toBeGreaterThanOrEqual(1);
            expect(step.dealtIds.some((id) => game.state.staging.includes(id)), golden.name).toBe(false);
          }
        }
      });
    },
  });
});

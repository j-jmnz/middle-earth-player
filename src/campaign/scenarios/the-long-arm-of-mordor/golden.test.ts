// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, hrd.setup-the-long-arm-of-mordor, hrd.objective-hero-elimination, hrd.heroes-in-the-staging-area, hrd.guarded-heroes (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { MORDOR_GOLDENS, playGolden, mordorWorld, type MordorDecks, type MordorGolden } from "../../../../test/scenarios/the-long-arm-of-mordor/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const mordor = loadAnyScenario("the-long-arm-of-mordor");
const OBJECTIVE = ["16031", "16032", "16033", "16034"];
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Long Arm of Mordor played by the auto-player (test/scenarios/the-long-arm-of-mordor/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed: the players quest through stages 1 and 2 (taking back the staged heroes), kill the guards of stage 3
// and defeat the Uruk Chieftain of stage 4. The losses are every player's threat at 50 and every player eliminated by destroyed heroes (an objective-hero leaving play eliminates its player). Update the snapshot only when the change is meant.
describe("The Long Arm of Mordor golden", () => {
  goldenSuite<MordorGolden, MordorDecks>({
    title: "The Long Arm of Mordor",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: mordor,
    standalone: true,
    goldens: MORDOR_GOLDENS,
    world: mordorWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with every hero in the staging area, each player holding an objective-hero with 2 resources (3 after the first resource phase) and one Sauron's Enforcers in the staging area for each player, the Uruk Chieftain set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "16071", face: "B", zone: "questStage" });
        expect(cardsOf(state, "16035").filter((card) => card.zone === "staging"), golden.name).toHaveLength(golden.seatCount);
        expect(cardsOf(state, "16061").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        for (const seat of state.seats.slice(0, golden.seatCount)) {
          const objective = seat.heroes.map((id) => state.cards[id]).filter((card) => card && OBJECTIVE.includes(card.code));
          expect(objective, golden.name).toHaveLength(1);
          // The 2 resources of the Setup and the 1 of the first resource phase.
          expect(objective[0]?.resources, golden.name).toBe(3);
        }
        expect(Object.values(state.cards).filter((card) => card.captive && card.host == null), golden.name).not.toHaveLength(0);
      },
    },
    wins: "ends when stage 4B is defeated with the Uruk Chieftain out of play, settles at once with a score and earns nothing",
    won(state, golden) {
      // The game ended on the last stage: the Chieftain is no longer in play and every player is alive.
      expect(state.stageCleared, golden.name).toBe(true);
      expect(cardsOf(state, "16061").filter((card) => ["staging", "engaged"].includes(card.zone)), golden.name).toEqual([]);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      if (golden.decks === "tense") expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      // The brittle heroes die: no seat reached a threat of 50.
      else expect(seats.every((seat) => seat.threat < 50), golden.name).toBe(true);
    },
  });
});

// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json).
import { describe, expect } from "vitest";

import { HARAD_GOLDENS, playGolden, haradWorld, type HaradDecks, type HaradGolden } from "../../../../test/scenarios/race-across-harad/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const harad = loadAnyScenario("race-across-harad");

// A permanent golden: whole standalone games of Race Across Harad played by the auto-player (test/scenarios/race-across-harad/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed (stage 4B defeated before the Orcs fill their stage 4D); the losses are the Orcs filling stage 2D, 3D and 4D, the Tamed Mûmak leaving play, every player at a threat of 50 and every hero destroyed. Update the snapshot only when the change is meant.
describe("Race Across Harad golden", () => {
  goldenSuite<HaradGolden, HaradDecks>({
    title: "Race Across Harad",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: harad,
    standalone: true,
    goldens: HARAD_GOLDENS,
    world: haradWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 2A (Setting Out has found a location for each player and advanced) with a Tamed Mûmak in play for each player, River Harnen set aside, the Uruk Warg-rider added to the staging or the Orcs' area, and the Orcs' area at stage 1 holding Uruk Chieftain",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "17048", zone: "questStage" });
        const of = (code: string) => Object.values(state.cards).filter((card) => card.code === code);
        expect(of("17038").filter((card) => card.zone === "play").map((card) => card.controller), golden.name).toEqual(Array.from({ length: golden.seatCount }, (_, seat) => seat));
        expect(of("17039").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(of("16063").filter((card) => card.zone === "orcsArea" || card.zone === "staging"), golden.name).toHaveLength(1);
        expect(state.orcs?.number, golden.name).toBe(1);
        expect(of("16061").map((card) => card.zone), golden.name).toEqual(["orcsArea"]);
      },
    },
    wins: "ends when stage 4B is defeated (River Harnen travelled to and explored first) before the Orcs fill their stage 4D, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.stageCleared, golden.name).toBe(true);
      expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "17050" });
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      const mumakil = Object.values(state.cards).filter((card) => card.code === "17038" && card.zone !== "removed");
      if (golden.name.includes("Orcs fill")) {
        // The Orcs' stage was defeated with the loss line of its own: a seat still stood.
        expect(seats.some((seat) => !seat.eliminated), golden.name).toBe(true);
      } else if (golden.name.includes("threat")) expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else if (golden.name.includes("Mûmak")) expect(mumakil.every((card) => card.zone !== "play"), golden.name).toBe(true);
      else expect(mumakil.every((card) => card.zone === "play"), golden.name).toBe(true);
    },
  });
});
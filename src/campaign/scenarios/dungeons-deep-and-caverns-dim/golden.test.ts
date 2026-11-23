// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, hob.riddle-area, hob.riddles, hob.riddles-steps-2-and-3, hob.bilbo-baggins-ohauh, docs/scenarios/the-hobbit.md (Dungeons Deep and Caverns Dim) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { DIM_GOLDENS, playGolden, dimWorld, type DimDecks, type DimGolden } from "../../../../test/scenarios/dungeons-deep-and-caverns-dim/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-hobbit");
const dim = loadAnyScenario("dungeons-deep-and-caverns-dim");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const inZone = (state: ScenarioState, zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();

// A permanent golden: whole standalone games of Dungeons Deep and Caverns Dim played by the auto-player (test/scenarios/dungeons-deep-and-caverns-dim/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal: the first player answers the riddles with what his deck holds, stage 2 fills and the quest
// moves on to Into the Fire, where defeating the stage wins. The losses are every player's threat at 50 (heroes too small to quest) and Bilbo Baggins destroyed by Gollum after riddles that found no match. Update the snapshot only when the change is meant.
describe("Dungeons Deep and Caverns Dim golden", () => {
  goldenSuite<DimGolden, DimDecks>({
    title: "Dungeons Deep and Caverns Dim",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: dim,
    standalone: true,
    goldens: DIM_GOLDENS,
    world: dimWorld,
    play: playGolden,
    opening: {
      title: "opens on Out of the Frying Pan with Lake in the Cavern staged and the riddle area made: Riddles in the Dark and Gollum in it, Bilbo's Magic Ring on Bilbo Baggins, who leads the first seat's heroes",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("131029");
        expect(codesOf(state, state.staging), golden.name).toEqual(["131078"]);
        expect(inZone(state, "riddleArea"), golden.name).toEqual(["131030", "131074"]);
        expect(codesOf(state, state.questDeck), golden.name).toEqual(["131031"]);
        const ring = Object.values(state.cards).find((card) => card.code === "131079");
        expect(ring?.zone, golden.name).toBe("attached");
        expect(state.cards[ring?.host ?? ""]?.code, golden.name).toBe("131001");
        expect(codesOf(state, state.seats[0]?.heroes.slice(0, 1) ?? []), golden.name).toEqual(["131001"]);
        expect(codesOf(state, state.encounterDeck), golden.name).not.toContain("131074");
      },
    },
    wins: "wins when Into the Fire is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("131031");
      expect(state.cards[Object.values(state.cards).find((card) => card.code === "131030")?.id ?? ""]?.zone, golden.name).toBe("removed");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.decks === "weak") {
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
        return;
      }
      // Bilbo Baggins was destroyed by Gollum's attack: the game is lost with the players' heroes still in play.
      const bilbo = Object.values(state.cards).find((card) => card.code === "131001");
      expect(bilbo?.zone, golden.name).not.toBe("heroes");
      expect(seats.some((seat) => seat.heroes.length > 0), golden.name).toBe(true);
    },
  });
});

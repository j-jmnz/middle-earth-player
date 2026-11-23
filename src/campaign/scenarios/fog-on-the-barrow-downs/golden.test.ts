// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, mec108.create-staging-area, mec109.multiple-staging-areas, ltp.scoring, docs/scenarios/standalone-scenarios/fog-on-the-barrow-downs.md (Fog on the Barrow-downs) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { parkedStage } from "../../../rules/families/breaking/areas.ts";

import { DOWNS_GOLDENS, playGolden, downsWorld, type DownsDecks, type DownsGolden } from "../../../../test/scenarios/fog-on-the-barrow-downs/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const downs = loadAnyScenario("fog-on-the-barrow-downs");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
// The causes that tell a game's path: a player back at stage 3B from stage 4B (1 progress on a Great Barrow) and a player raised by 10 for an elimination while apart.
const causeOf = (step: unknown): string => ((step as { cause?: { effect?: string } }).cause?.effect ?? "");

// A permanent golden: whole standalone games of Fog on the Barrow-downs played by the auto-player (test/scenarios/fog-on-the-barrow-downs/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal: a Great Barrow splits a player off to a stage 4A of his own (a solo player parks stage 3B),
// stage 4B sends him back to stage 3B, and defeating it with every player there and Standing Stones in the victory display wins the game. The losses are every player's threat at 50 in stage 2 (heroes too small to quest), a solo player
// destroyed at stage 4B with stage 3B parked, and two players destroyed while apart. Update the snapshot only when the change is meant.
describe("Fog on the Barrow-downs golden", () => {
  goldenSuite<DownsGolden, DownsDecks>({
    title: "Fog on the Barrow-downs",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: downs,
    standalone: true,
    goldens: DOWNS_GOLDENS,
    world: downsWorld,
    play: playGolden,
    opening: {
      title: "opens on The House of Tom Bombadil with stages 2, 3 and a 4A for each player in the quest deck, every Great Barrow, Standing Stones and Hollow Circle set aside and nothing in the staging area",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("148001");
        const stages = codesOf(state, state.questDeck).sort();
        expect(stages.slice(0, 2), golden.name).toEqual(["148002", "148003"]);
        expect(stages.slice(2), golden.name).toEqual(Array.from({ length: golden.seatCount }, () => "148004"));
        const barrows = golden.difficulty === "Easy" ? 3 : 5;
        expect(codesOf(state, state.setAside).sort(), golden.name).toEqual(["148005", "148006", ...Array.from({ length: barrows }, () => "148007")]);
        expect(state.staging, golden.name).toEqual([]);
        expect(state.separate, golden.name).toBeUndefined();
      },
    },
    wins: "wins when stage 3B is defeated with every player at it and Standing Stones in the victory display, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("148003");
      expect(state.separate, golden.name).toBeUndefined();
      expect(codesOf(state, state.victory), golden.name).toContain("148006");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
      // Stage 3B stays in play, parked, when the last player at it is gone and the others are still apart.
      if (golden.parked) {
        expect(state.separate, golden.name).toBe(true);
        expect(codesOf(state, [parkedStage(state) ?? ""]), golden.name).toEqual(["148003"]);
      }
    },
    causeTitle: "names a record of the scenario for every number, and each player who came back from stage 4B or was raised by 10 while apart did it by its record",
    cause(game, golden) {
      const effects = game.steps.map(causeOf);
      expect(effects.filter((effect) => effect === "148004:forced:2").length, golden.name).toBe(golden.returns);
      expect(effects.filter((effect) => effect === "148003:forced:1").length, golden.name).toBe(golden.raises ?? 0);
    },
  });
});

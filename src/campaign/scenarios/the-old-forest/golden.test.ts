// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, ltp.scoring, docs/brief.md (The Old Forest) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { FOREST_GOLDENS, playGolden, forestWorld, type ForestDecks, type ForestGolden } from "../../../../test/scenarios/the-old-forest/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const forest = loadAnyScenario("the-old-forest");
const STAGE_2 = ["147002", "147003", "147004", "147005"];
const LOCATIONS = ["147012", "147013", "147014", "147015", "147016"];
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// A permanent golden: whole standalone games of The Old Forest played by the auto-player (test/scenarios/the-old-forest/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and true solo on Easy: Farewell to the Shire opens the game, the quest goes to a random stage 2A
// and, with enough Victory points in the display, to The Wicked Willow, where Old Man Willow is held in the staging area and the stage is defeated with Withywindle out of play. The losses are every player's threat at 50 (heroes too
// small to quest) and every hero destroyed. Update the snapshot only when the change is meant.
describe("The Old Forest golden", () => {
  goldenSuite<ForestGolden, ForestDecks>({
    title: "The Old Forest",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: forest,
    standalone: true,
    goldens: FOREST_GOLDENS,
    world: forestWorld,
    play: playGolden,
    opening: {
      title: "opens on a random stage 2A with the other three stage 2s and The Wicked Willow in the quest deck, Farewell to the Shire set aside, Old Man Willow and Withywindle set aside and a location searched for each player in the staging area",
      check(state, golden) {
        const stage = state.cards[state.questStage ?? ""]?.code ?? "";
        expect(STAGE_2, golden.name).toContain(stage);
        expect(codesOf(state, state.questDeck).sort(), golden.name).toEqual(["147002", "147003", "147004", "147005", "147006"].filter((code) => code !== stage));
        expect(codesOf(state, state.setAside).sort(), golden.name).toEqual(["147001", "147007", "147011"]);
        expect(state.staging.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
        expect(codesOf(state, state.staging).every((code) => LOCATIONS.includes(code ?? "")), golden.name).toBe(true);
      },
    },
    wins: "wins when The Wicked Willow is defeated (stage 3B) with Withywindle out of play, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("147006");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
      // Old Man Willow came with the stage and Withywindle was out of play when it ended.
      expect(Object.values(state.cards).filter((card) => card.code === "147011").every((card) => card.zone !== "staging" && card.zone !== "activeLocation"), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

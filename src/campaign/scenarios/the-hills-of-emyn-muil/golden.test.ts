// Rules: rr.setup, rr.quest-advancement, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, sotm.setup-the-hills-of-emyn-muil, sotm.emyn-muil-victory-points, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import { printedOf } from "../../../rules/core/printed.ts";
import { victoryPointsOf } from "../../../rules/core/printed-stat.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import { MUIL_GOLDENS, playGolden, muilWorld, type MuilDecks, type MuilGolden } from "../../../../test/scenarios/the-hills-of-emyn-muil/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const muil = loadAnyScenario("the-hills-of-emyn-muil");

const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Hills of Emyn Muil played by the auto-player (test/scenarios/the-hills-of-emyn-muil/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, solo on Easy and two-handed on Nightmare: the players explore Amon Hen, Amon Lhaw and the other Emyn Muil locations until none is in play and the victory display holds 20 Victory points, with the
// quest's one progress. The losses are each way to lose, every player's threat at 50 and every hero destroyed. The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Hills of Emyn Muil golden", () => {
  goldenSuite<MuilGolden, MuilDecks>({
    title: "The Hills of Emyn Muil",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: muil,
    standalone: true,
    goldens: MUIL_GOLDENS,
    world: muilWorld,
    play: playGolden,
    opening: {
      title: "starts with Amon Hen and Amon Lhaw in the staging area, the quest card as the one stage, and on Nightmare the setup card out of play",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02082");
        expect(state.staging.map((id) => state.cards[id]?.code).sort(), golden.name).toEqual(["02083", "02084"]);
        expect(state.questDeck, golden.name).toEqual([]);
        expect(cardsOf(state, "900701").map((card) => card.zone), golden.name).toEqual(golden.difficulty === "Nightmare" ? ["nightmare"] : []);
      },
    },
    wins: "ends when the quest card's one progress is placed with no Emyn Muil location in play and 20 Victory points in the victory display, settles at once with a score and earns nothing",
    won(state, golden, world) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02082");
      // Both conditions of the stage hold: the display holds 20 Victory points and no Emyn Muil location is in the staging area or active.
      expect(state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, world.cards), 0), golden.name).toBeGreaterThanOrEqual(20);
      const inPlay = [...state.staging, ...(state.activeLocation ? [state.activeLocation] : [])];
      expect(inPlay.filter((id) => printedOf(world.cards, state.cards[id]?.code ?? "").traits.includes("Emyn Muil")), golden.name).toEqual([]);
      expect(state.cards[state.questStage ?? ""]?.progress, golden.name).toBeGreaterThanOrEqual(1);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, rr.victory, rr.forced, rr.destroy, rr.explored, docs/scenarios/standalone-scenarios.md (Attack on Dol Guldur) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { GULDUR_GOLDENS, playGolden, guldurWorld, type GuldurDecks, type GuldurGolden } from "../../../../test/scenarios/attack-on-dol-guldur/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const guldur = loadAnyScenario("attack-on-dol-guldur");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const cityOf = (state: ScenarioState) => Object.values(state.cards).find((card) => card.code === "50907")?.resources ?? 0;
const LIEUTENANTS = ["50910", "50911", "50912", "50913"];

// A permanent golden: whole standalone games of Attack on Dol Guldur played by the auto-player (test/scenarios/attack-on-dol-guldur/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal: the players take the first stage's resources to stage 2, move on to a stage 3, destroy the enemies with the most
// Siege value until the city strength of Dol Guldur is 0 and destroy the Lieutenant. The scenario has no city-strength loss, so the losses are every player's threat at 50 (heroes too small to quest) and every hero destroyed. Update the snapshot only when the change is meant.
describe("Attack on Dol Guldur golden", () => {
  goldenSuite<GuldurGolden, GuldurDecks>({
    title: "Attack on Dol Guldur",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: guldur,
    standalone: true,
    goldens: GULDUR_GOLDENS,
    world: guldurWorld,
    play: playGolden,
    opening: {
      title: "opens on Assault on the Golden Wood with Dol Guldur (city strength 5 plus 5 for each player), Power of Lórien and a Dol Guldur Marauder for each player in the staging area, the Standard Game Mode beside the quest deck, and the Host of Lórien and the four Lieutenants set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50901");
        expect(codesOf(state, state.staging), golden.name).toEqual(expect.arrayContaining(["50907", "50908"]));
        expect(codesOf(state, state.staging).filter((code) => code === "50918"), golden.name).toHaveLength(golden.seatCount);
        expect(cityOf(state), golden.name).toBe(5 + 5 * golden.seatCount);
        expect(Object.values(state.cards).some((card) => card.code === "50931" && card.zone === "modeCard"), golden.name).toBe(true);
        expect(codesOf(state, state.setAside), golden.name).toEqual(expect.arrayContaining(["50909", ...LIEUTENANTS]));
      },
    },
    wins: "wins when the city strength of Dol Guldur is 0 and no Lieutenant is in play at the end of a round (a stage 3), settles at once with a score and earns nothing",
    won(state, golden) {
      expect(cityOf(state), golden.name).toBe(0);
      expect(codesOf(state, state.victory).some((code) => LIEUTENANTS.includes(code ?? "")), golden.name).toBe(true);
      expect(codesOf(state, [...state.staging, ...state.seats.flatMap((seat) => seat.engaged)]).some((code) => LIEUTENANTS.includes(code ?? "")), golden.name).toBe(false);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      // Two ways to lose: every threat reached 50, or no hero is left.
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

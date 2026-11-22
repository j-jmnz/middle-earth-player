// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, rr.victory, rr.immune, rr.forced, docs/scenarios/standalone-scenarios.md (The Siege of Annúminas) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { ANNUMINAS_GOLDENS, playGolden, annuminasWorld, type AnnuminasDecks, type AnnuminasGolden } from "../../../../test/scenarios/the-siege-of-annuminas/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const annuminas = loadAnyScenario("the-siege-of-annuminas");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const cityOf = (state: ScenarioState) => Object.values(state.cards).find((card) => card.code === "50812")?.resources ?? 0;

// A permanent golden: whole standalone games of The Siege of Annúminas played by the auto-player (test/scenarios/the-siege-of-annuminas/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal: the players take the stages in turn, explore the Battering Ram, raise the progress to 10 and
// destroy the Lieutenant of Angmar at stage 3B. The losses are the city strength at 0, every player's threat at 50 (heroes too small to quest) and every hero destroyed. Update the snapshot only when the change is meant.
describe("The Siege of Annúminas golden", () => {
  goldenSuite<AnnuminasGolden, AnnuminasDecks>({
    title: "The Siege of Annúminas",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: annuminas,
    standalone: true,
    goldens: ANNUMINAS_GOLDENS,
    world: annuminasWorld,
    play: playGolden,
    opening: {
      title: "opens on Rebuild the Defenses with Annúminas (city strength 20) and the Gate of Annúminas in the staging area, the Standard Game Mode beside the quest deck, and the Lieutenant, the Battering Ram, the Enemy Camp, the Siege Tunnel, the Hosts and the Dúnedain of Annúminas set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50803");
        expect(codesOf(state, state.staging), golden.name).toContain("50812");
        expect(codesOf(state, state.staging), golden.name).toContain("50819");
        expect(cityOf(state), golden.name).toBe(20);
        expect(Object.values(state.cards).some((card) => card.code === "50801" && card.zone === "modeCard"), golden.name).toBe(true);
        expect(codesOf(state, state.setAside).filter((code) => code === "50817"), golden.name).toHaveLength(3);
        expect(codesOf(state, state.setAside), golden.name).toEqual(expect.arrayContaining(["50813", "50814", "50815", "50816"]));
      },
    },
    wins: "wins when the Lieutenant of Angmar is in the victory display at the end of a round of stage 3B (Lead the Sortie), settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50805");
      expect(codesOf(state, state.victory), golden.name).toContain("50813");
      expect(cityOf(state), golden.name).toBeGreaterThan(0);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Three ways to lose: the city strength reached 0, every threat reached 50, or no hero is left.
      if (golden.decks === "strong") {
        expect(cityOf(state), golden.name).toBe(0);
        expect(codesOf(state, state.victory), golden.name).not.toContain("50813");
        return;
      }
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

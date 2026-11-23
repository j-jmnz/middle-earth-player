// Rules: rr.setup, rr.search, rr.explored, rr.engaged, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, rr.damage, ltp.scoring, docs/scenarios/standalone-scenarios/escape-from-khazad-dum.md (Escape from Khazad-dûm) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { KHAZAD_GOLDENS, playGolden, khazadWorld, type KhazadDecks, type KhazadGolden } from "../../../../test/scenarios/escape-from-khazad-dum/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const khazad = loadAnyScenario("escape-from-khazad-dum");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// A permanent golden: whole standalone games of Escape from Khazad-dûm played by the auto-player (test/scenarios/escape-from-khazad-dum/game.ts) on fixed seeds, through wins with different pairs of stage cards and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed: Dark Pit is explored at stage 1B and flips, setting Durin's Bane aside, and the stage 3 card of the first player's choice is defeated
// (Last Lord of Moria with Durin's Bane killed). The losses are the stage holding damage equal to its quest points (the players leave Durin's Bane's attacks undefended), every player's threat at 50 (heroes too small to quest) and every hero destroyed (brittle heroes).
// Update the snapshot only when the change is meant.
describe("Escape from Khazad-dûm golden", () => {
  goldenSuite<KhazadGolden, KhazadDecks>({
    title: "Escape from Khazad-dûm",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: khazad,
    standalone: true,
    goldens: KHAZAD_GOLDENS,
    world: khazadWorld,
    play: playGolden,
    opening: {
      title: "opens on Out of the Depths with Dark Pit in the staging area, the encounter deck built from 7 of the 14 sets (35 cards less the 0 cost card each player's Setup search found) and the 3 stage cards of the first player's choice the only ones in the quest deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("51301");
        expect(codesOf(state, state.staging), golden.name).toContain("51310");
        // The first player has chosen one stage 2 and one stage 3 card; the other four wait out of the game.
        expect(state.stages.map((stage) => stage.code), golden.name).toHaveLength(3);
        expect(state.stages[0]?.code, golden.name).toBe("51301");
        // 7 sets of 5 cards, less the 0 cost enemy or location each player's Setup search added to the staging area (standalone.test.ts counts the sets).
        expect(state.encounterDeck.length, golden.name).toBeLessThanOrEqual(35);
      },
    },
    wins: "wins when the stage 3 card of the first player's choice is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(["51307", "51308", "51309"], golden.name).toContain(state.cards[state.questStage ?? ""]?.code);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
      // Dark Pit flipped into Durin's Bane at stage 1B: Durin's Bane is in the game, in play or in the victory display.
      expect(Object.values(state.cards).some((card) => card.code === "51311"), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.policy?.undefended === true) {
        // The loss of 51307:B:3: the stage holds damage equal to its quest points.
        expect(state.lossReason, golden.name).toContain("Nearing the Gate holds");
        expect(state.cards[state.questStage ?? ""]?.damage, golden.name).toBeGreaterThanOrEqual(10);
        return;
      }
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

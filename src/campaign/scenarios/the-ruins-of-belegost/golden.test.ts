// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, emce.discover, emce.loot, ltp.scoring, docs/scenarios/standalone-scenarios/the-ruins-of-belegost.md (The Ruins of Belegost) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { BELEGOST_GOLDENS, playGolden, belegostWorld, type BelegostDecks, type BelegostGolden } from "../../../../test/scenarios/the-ruins-of-belegost/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const belegost = loadAnyScenario("the-ruins-of-belegost");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const LOOT = ["50610", "50611", "50612", "50613", "50614"];

// A permanent golden: whole standalone games of The Ruins of Belegost played by the auto-player (test/scenarios/the-ruins-of-belegost/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal: the players travel to the Discover locations for Loot objectives, destroy Lurker of the Depths
// for stage 2A, take the stage branches to the Beast of Belegost, explore Naurlhûg's Lair and defeat Naurlhûg. The losses are every player's threat at 50 (heroes too small to quest) and every hero destroyed. Update the snapshot only
// when the change is meant.
describe("The Ruins of Belegost golden", () => {
  goldenSuite<BelegostGolden, BelegostDecks>({
    title: "The Ruins of Belegost",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: belegost,
    standalone: true,
    goldens: BELEGOST_GOLDENS,
    world: belegostWorld,
    play: playGolden,
    opening: {
      title: "opens on Ruins of the First Age with Stalking the Ruins and an Abandoned Mine for each player in the staging area, one Loot objective facedown under Stalking the Ruins and the other four in the encounter deck, and Lurker of the Depths, Naurlhûg, its Lair and the Sword of Belegost set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50601");
        expect(codesOf(state, state.staging).sort(), golden.name).toEqual(["50608", ...Array.from({ length: golden.seatCount }, () => "50622")]);
        expect(codesOf(state, state.setAside).sort(), golden.name).toEqual(["50609", "50615", "50616", "50621"]);
        const under = Object.values(state.cards).filter((card) => card.zone === "under");
        expect(under.map((card) => card.code), golden.name).toHaveLength(1);
        expect(LOOT, golden.name).toContain(under[0]?.code);
        expect(codesOf(state, state.encounterDeck).filter((code) => LOOT.includes(code ?? "")), golden.name).toHaveLength(4);
      },
    },
    wins: "wins when Naurlhûg is defeated at stage 4A (the Beast of Belegost), settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50607");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
      // Naurlhûg's Lair was explored and lies in the victory display, so Naurlhûg could take damage.
      expect(codesOf(state, state.victory), golden.name).toContain("50621");
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

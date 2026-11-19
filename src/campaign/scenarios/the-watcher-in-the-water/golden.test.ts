// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, dwd.setup-the-watcher-in-the-water, dwd.setup-the-watcher-in-the-water-set-aside, dwd.doors-of-durin, rr.victory, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { WATER_GOLDENS, playGolden, waterWorld, type WaterDecks, type WaterGolden } from "../../../../test/scenarios/the-watcher-in-the-water/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const water = loadAnyScenario("the-watcher-in-the-water");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);

// A permanent golden: whole standalone games of The Watcher in the Water played by the auto-player (test/scenarios/the-watcher-in-the-water/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: Setup sets The Watcher and Doors of Durin aside, the players quest through To the West-door (a card revealed until the staging area holds twice the players' Threat), The Seething Lake brings The Watcher and
// Doors of Durin into play, and the game is won when the stage's 5 progress and 3 victory points are there (Normal: The Watcher killed; Easy: Doors of Durin by a matching letter; Nightmare: both cards in the victory display, the Nightmare Watcher standing for the other). The losses are the ways to
// lose here: every player's threat at 50 (heroes too weak to quest), every hero destroyed, and on Nightmare the stage waiting for the two cards while the threat climbs. The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Watcher in the Water golden", () => {
  goldenSuite<WaterGolden, WaterDecks>({
    title: "The Watcher in the Water",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: water,
    standalone: true,
    goldens: WATER_GOLDENS,
    world: waterWorld,
    play: playGolden,
    opening: {
      title: "starts on To the West-door with The Seething Lake next, The Watcher and Doors of Durin set aside (the Nightmare Watcher in place of The Watcher, and the setup card, on Nightmare) and the Tentacle cards in the encounter deck",
      check(state, golden) {
        const nightmare = golden.difficulty === "Nightmare";
        expect(codeOf(state, state.questStage), golden.name).toBe("04063");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["04064"]);
        expect(state.setAside.map((id) => codeOf(state, id)).sort(), golden.name).toEqual(nightmare ? ["04065", "901502"] : ["04065", "04072"]);
        expect(cardsOf(state, "901501").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
        expect(cardsOf(state, "04072").length, golden.name).toBe(nightmare ? 0 : 1);
      },
    },
    wins: "ends when The Seething Lake is defeated with 3 victory points in the victory display, settles at once with a score and earns nothing",
    won(state, golden) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "04064" ? "04064" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("04064");
      const victory = state.victory.map((id) => codeOf(state, id));
      // Nightmare needs both cards (the setup card's bar); the box needs 3 victory points, either card alone.
      if (golden.difficulty === "Nightmare") expect(victory, golden.name).toEqual(expect.arrayContaining(["04065", "901502"]));
      else expect(victory.some((code) => code === "04065" || code === "04072"), golden.name).toBe(true);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Three ways to lose: the threat reached 50 (weak heroes, or the stage waiting on Nightmare), or no hero is left (brittle).
      if (golden.decks === "brittle") expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      if (golden.difficulty === "Nightmare") {
        // The stage holds its 5 progress and waits for the two cards, the Nightmare Watcher not in the victory display.
        expect(codeOf(state, state.questStage), golden.name).toBe("04064");
        expect(state.victory.map((id) => codeOf(state, id)), golden.name).not.toContain("901502");
      }
    },
  });
});

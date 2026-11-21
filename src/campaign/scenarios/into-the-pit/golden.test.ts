// Rules: rr.first-player, rr.search, rr.replacement-effects, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, dwd.cave-torch-the-long-dark, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { PIT_GOLDENS, playGolden, pitWorld, type PitDecks, type PitGolden } from "../../../../test/scenarios/into-the-pit/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const pit = loadAnyScenario("into-the-pit");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Into the Pit played by the auto-player (test/scenarios/into-the-pit/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: the players quest through East-gate, First Hall and Bridge of Khazad-dûm, then defeat A Way Up (stage 2 is Goblin Ambush on Nightmare). The losses are the two ways to lose:
// every player's threat at 50 (heroes too weak to quest) and every hero destroyed. The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("Into the Pit golden", () => {
  goldenSuite<PitGolden, PitDecks>({
    title: "Into the Pit",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: pit,
    standalone: true,
    goldens: PIT_GOLDENS,
    world: pitWorld,
    play: playGolden,
    opening: {
      title: "starts at Entering the Mines with East-gate the active location, First Hall and the Bridge set aside, Cave Torch on a hero, a card revealed for each player and, on Nightmare, the setup card in play",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("03064");
        expect(state.cards[state.activeLocation ?? ""]?.code, golden.name).toBe("03016");
        expect(cardsOf(state, "03017").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(cardsOf(state, "03018").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        // The later stages wait in the quest deck: Goblin Patrol, or Goblin Ambush in its place on Nightmare, then A Way Up.
        const second = golden.difficulty === "Nightmare" ? "901002" : "03065";
        expect(cardsOf(state, second).map((card) => card.zone), golden.name).toEqual(["questDeck"]);
        expect(cardsOf(state, golden.difficulty === "Nightmare" ? "03065" : "901002"), golden.name).toEqual([]);
        expect(cardsOf(state, "03066").map((card) => card.zone), golden.name).toEqual(["questDeck"]);
        // Cave Torch is attached to a hero, not in the encounter deck, and the Setup revealed 1 card for each player.
        const torch = cardsOf(state, "03041");
        expect(torch.map((card) => card.zone), golden.name).toEqual(["play"]);
        expect(state.cards[torch[0]?.host ?? ""]?.zone, golden.name).toBe("heroes");
        expect(torch[0]?.temporary, golden.name).toBe(true);
        const staged = Object.values(state.cards).filter((card) => card.zone === "staging" || card.zone === "encounterDiscard" || card.zone === "engaged");
        expect(staged.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
        expect(cardsOf(state, "901001").map((card) => card.zone), golden.name).toEqual(golden.difficulty === "Nightmare" ? ["nightmare"] : []);
      },
    },
    wins: "ends when A Way Up is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("03066");
      // East-gate and Bridge of Khazad-dûm are explored and lie in the victory display; the Torch's hero or the Torch itself is still the players'.
      expect(cardsOf(state, "03016").map((card) => card.zone), golden.name).toEqual(["victory"]);
      expect(cardsOf(state, "03018").map((card) => card.zone), golden.name).toEqual(["victory"]);
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

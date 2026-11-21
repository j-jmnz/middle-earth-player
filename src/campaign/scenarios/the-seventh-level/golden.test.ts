// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, dwd.book-of-mazarbul, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { LEVEL_GOLDENS, playGolden, levelWorld, type LevelDecks, type LevelGolden } from "../../../../test/scenarios/the-seventh-level/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const level = loadAnyScenario("the-seventh-level");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Seventh Level played by the auto-player (test/scenarios/the-seventh-level/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: the players quest through Search for the Chamber and defeat The Fate of Balin (on Nightmare they first destroy Overseer Maurûl, who bars the stage). The losses are the two ways
// to lose: every player's threat at 50 (heroes too weak to quest) and every hero destroyed. The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Seventh Level golden", () => {
  goldenSuite<LevelGolden, LevelDecks>({
    title: "The Seventh Level",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: level,
    standalone: true,
    goldens: LEVEL_GOLDENS,
    world: levelWorld,
    play: playGolden,
    opening: {
      title: "starts at Search for the Chamber with The Fate of Balin in the quest deck, Book of Mazarbul attached to a hero and, on Nightmare, the setup card in play with Overseer Maurûl and Chamber of Records set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("03067");
        expect(cardsOf(state, "03068").map((card) => card.zone), golden.name).toEqual(["questDeck"]);
        // The Book is attached to a hero (the first player's choice), free of any exhaust.
        const book = cardsOf(state, "03024");
        expect(book.map((card) => card.zone), golden.name).toEqual(["attached"]);
        expect(state.cards[book[0]?.host ?? ""]?.zone, golden.name).toBe("heroes");
        const nightmare = golden.difficulty === "Nightmare";
        expect(cardsOf(state, "901101").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
        expect(cardsOf(state, "901102").map((card) => card.zone), golden.name).toEqual(nightmare ? ["setAside"] : []);
        expect(cardsOf(state, "901103").map((card) => card.zone), golden.name).toEqual(nightmare ? ["setAside"] : []);
      },
    },
    wins: "ends when The Fate of Balin is defeated (on Nightmare, with Overseer Maurûl in the victory display), settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("03068");
      // Stage 2B's When Revealed removed the Book from the game.
      expect(cardsOf(state, "03024").map((card) => card.zone), golden.name).toEqual(["removed"]);
      if (golden.difficulty === "Nightmare") expect(cardsOf(state, "901102").map((card) => card.zone), golden.name).toEqual(["victory"]);
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

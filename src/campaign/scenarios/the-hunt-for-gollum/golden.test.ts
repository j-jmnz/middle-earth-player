// Rules: rr.guarded, rr.objective-cards, rr.first-player, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, sotm.reset-the-quest-deck, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { GOLLUM_GOLDENS, playGolden, gollumWorld, type GollumDecks, type GollumGolden } from "../../../../test/scenarios/the-hunt-for-gollum/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const gollum = loadAnyScenario("the-hunt-for-gollum");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Hunt for Gollum played by the auto-player (test/scenarios/the-hunt-for-gollum/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: Setup reveals a card for each player, the players claim a Clue after a successful quest (a Response, a hero committed to the quest) and the quest ends on stage 3, On the Trail. The losses are the three ways to
// lose: every player's threat at 50 (heroes too weak to quest), every hero destroyed, and on Nightmare four Clues attached to Mordor enemies (900401:A:3). The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Hunt for Gollum golden", () => {
  goldenSuite<GollumGolden, GollumDecks>({
    title: "The Hunt for Gollum",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: gollum,
    standalone: true,
    goldens: GOLLUM_GOLDENS,
    world: gollumWorld,
    play: playGolden,
    opening: {
      title: "starts at The Hunt Begins with a card revealed for each player in the staging area, the later stages in the quest deck and, on Nightmare, the Nightmare card in play",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02011");
        expect(cardsOf(state, "02012").map((card) => card.zone), golden.name).toEqual(["questDeck"]);
        expect(cardsOf(state, "02013").map((card) => card.zone), golden.name).toEqual(["questDeck"]);
        // Setup reveals 1 card for each player: in the staging area, or discarded when it is a treachery (a Guarded Clue brings its guard along).
        const staged = Object.values(state.cards).filter((card) => card.zone === "staging" || card.zone === "encounterDiscard");
        expect(staged.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
        expect(cardsOf(state, "900401").map((card) => card.zone), golden.name).toEqual(golden.difficulty === "Nightmare" ? ["nightmare"] : []);
      },
    },
    wins: "ends when On the Trail is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02013");
      // A Clue was claimed on the way: the Signs of Gollum hang on a hero, a Condition attachment controlled by his player, or went back to the deck when he was hurt.
      expect(state.round, golden.name).toBeGreaterThan(1);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason === "Four Signs of Gollum") {
        // Four Clue cards are guarded by Mordor enemies (900401:A:3); every seat stands.
        const guarded = cardsOf(state, "02014").filter((card) => card.attachments.some((id) => state.cards[id]?.guard === true && state.cards[id]?.zone !== "encounterDiscard")).length;
        expect(guarded, golden.name).toBeGreaterThanOrEqual(4);
        expect(seats.every((seat) => !seat.eliminated), golden.name).toBe(true);
        return;
      }
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rm.current-trial, rr.objective-cards, rm.time-x (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { TRIALS_GOLDENS, playGolden, trialsWorld, type TrialsDecks, type TrialsGolden } from "../../../../test/scenarios/the-three-trials/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const trials = loadAnyScenario("the-three-trials");

const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Three Trials played by the auto-player (test/scenarios/the-three-trials/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and Easy: the players choose the three trials in turn, each ended when a hero holds its Key, then The Antlered Crown ends when Hallowed Circle is explored (it
// lies in the victory display). The losses are the ways to lose here: every player's threat reaches 50 and every hero destroyed. Update the snapshot only when the change is meant.
describe("The Three Trials golden", () => {
  goldenSuite<TrialsGolden, TrialsDecks>({
    title: "The Three Trials",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: trials,
    standalone: true,
    goldens: TRIALS_GOLDENS,
    world: trialsWorld,
    play: playGolden,
    opening: {
      title: "starts with the Setup played and the first player's trial chosen: that stage 2 in play, the other two and stage 3 in the quest deck, and one Guardian, one Barrow and its Key out of the set-aside pile",
      check(state, golden) {
        // The Choose (first option) took stage 2A of Strength: its Guardian, Barrow and Key are out, so 7 of the 10 cards stay set aside.
        expect(codeOf(state, state.questStage), golden.name).toBe("08036");
        expect(state.questDeck.map((id) => codeOf(state, id)).sort(), golden.name).toEqual(["08037", "08038", "08039"]);
        const aside = ["08040", "08041", "08042", "08043", "08044", "08045", "08046", "08047", "08048", "08049"].filter((code) => cardsOf(state, code).every((card) => card.zone === "setAside"));
        expect(aside.length, golden.name).toBe(7);
        expect(cardsOf(state, "08049").map((card) => card.zone), golden.name).toEqual(["setAside"]);
      },
    },
    wins: "ends when the last progress explores Hallowed Circle on The Antlered Crown (stage 3) after the three trials, and settles at once with a score and earns nothing",
    won(state, golden) {
      expect(codeOf(state, state.questStage), golden.name).toBe("08039");
      expect(cardsOf(state, "08049").map((card) => card.zone), golden.name).toEqual(["victory"]);
      // The three stage 2 quests were each done once, so each lies in the set-aside zone or the victory display and none is in the quest deck.
      expect(state.questDeck, golden.name).toEqual([]);
      // Each Key lies on a hero (claimed) or in the encounter piles, never lost; the Barrows are dealt once.
      for (const code of ["08040", "08041", "08042", "08043", "08044", "08045", "08046", "08047", "08048", "08049"]) expect(cardsOf(state, code).length, `${golden.name} ${code}`).toBe(1);
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      if (golden.decks === "brittle") expect(seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

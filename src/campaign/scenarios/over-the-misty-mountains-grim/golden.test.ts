// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, hob.setup-over-the-misty-mountains-grim, hob.active-and-inactive-encounter-decks, hob.bilbo-baggins-ohauh, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { GRIM_GOLDENS, playGolden, grimWorld, type GrimDecks, type GrimGolden } from "../../../../test/scenarios/over-the-misty-mountains-grim/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-hobbit");
const grim = loadAnyScenario("over-the-misty-mountains-grim");
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Over the Misty Mountains Grim played by the auto-player (test/scenarios/over-the-misty-mountains-grim/game.ts) on fixed seeds, Bilbo Baggins dealt in front of the first seat by the loadout.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and true solo on Easy: the Setup shuffles the first deck and sets the second aside, A Short Rest advances at once, The Mountain Pass finds a Stone-giant,
// Down, Down to Goblin Town swaps the decks, and the game is won when The Great Goblin is in the victory display and the stage is defeated. The losses are every player's threat at 50 (heroes too weak to quest), every hero destroyed (heroes too
// brittle) and Bilbo Baggins leaving play. Update the snapshot only when the change is meant.
describe("Over the Misty Mountains Grim golden", () => {
  goldenSuite<GrimGolden, GrimDecks>({
    title: "Over the Misty Mountains Grim",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: grim,
    standalone: true,
    goldens: GRIM_GOLDENS,
    world: grimWorld,
    play: playGolden,
    opening: {
      title: "starts on The Mountain Pass with Down, Down to Goblin Town next, Bilbo Baggins a hero of the first seat, and the second encounter deck (Misty Mountain Goblins and The Great Goblin) set aside",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("131027");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["131028"]);
        expect(state.seats[0]?.heroes.map((id) => codeOf(state, id)), golden.name).toContain("131001");
        expect(cardsOf(state, "131063").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(cardsOf(state, "131058").every((card) => card.zone === "setAside"), golden.name).toBe(true);
        expect(state.encounterDeck.length, golden.name).toBeGreaterThan(0);
      },
    },
    wins: "ends when Down, Down to Goblin Town is defeated with The Great Goblin in the victory display, settles at once with a score and earns nothing",
    won(state, golden) {
      const ended = codeOf(state, state.questStage) === "131028" ? "131028" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("131028");
      expect(cardsOf(state, "131063").map((card) => card.zone), golden.name).toEqual(["victory"]);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason === "Bilbo Baggins left play") expect(cardsOf(state, "131001").every((card) => card.zone !== "heroes"), golden.name).toBe(true);
      else if (golden.decks === "brittle") expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
    },
  });
});

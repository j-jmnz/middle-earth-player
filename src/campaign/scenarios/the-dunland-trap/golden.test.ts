// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.engaged, rr.active-location, rm.time-x (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { TRAP_GOLDENS, playGolden, trapWorld, type TrapDecks, type TrapGolden } from "../../../../test/scenarios/the-dunland-trap/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const trap = loadAnyScenario("the-dunland-trap");

const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Dunland Trap played by the auto-player (test/scenarios/the-dunland-trap/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and Easy: each ends on No Way Out (stage 3B) when its last time counter leaves (Chief Turch's engagements, Old South Road and the refresh phase take them off), the players make
// the engagement checks and every engaged enemy attacks, and no hero is destroyed. The losses are the ways to lose here: every player's threat reaches 50, a hero destroyed by the attacks after the last counter (stage 3B) and the last hero destroyed. Update the snapshot only when the change is meant.
describe("The Dunland Trap golden", () => {
  goldenSuite<TrapGolden, TrapDecks>({
    title: "The Dunland Trap",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: trap,
    standalone: true,
    goldens: TRAP_GOLDENS,
    world: trapWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with 2 time counters on it and stages 2 and 3 waiting, Old South Road the active location, Chief Turch and Munuv Dûv Ravine set aside, and a Boar Clan enemy engaged with each player",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("08011");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["08012", "08013"]);
        expect(state.cards[state.questStage ?? ""]?.resources, golden.name).toBe(2);
        expect(codeOf(state, state.activeLocation), golden.name).toBe("08016");
        expect(cardsOf(state, "08014").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(cardsOf(state, "08015").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        const engaged = Object.values(state.cards).filter((card) => card.zone === "engaged");
        expect(engaged.map((card) => card.controller).sort(), golden.name).toEqual([0, 1].slice(0, golden.seatCount));
        expect(engaged.every((card) => ["08017", "08018"].includes(card.code)), golden.name).toBe(true);
      },
    },
    wins: "ends when the last time counter leaves No Way Out (stage 3B), the engagement checks and the attacks that follow destroy no hero, and settles at once with a score and earns nothing",
    won(state, golden) {
      expect(codeOf(state, state.questStage), golden.name).toBe("08013");
      expect(state.cards[state.questStage ?? ""]?.resources, golden.name).toBe(0);
      // The three stages, Chief Turch, the Ravine and Old South Road are dealt once on every difficulty, and the Ravine came out of the set-aside pile.
      for (const code of ["08011", "08012", "08013", "08014", "08015", "08016"]) expect(cardsOf(state, code).length, `${golden.name} ${code}`).toBe(1);
      expect(cardsOf(state, "08015")[0]?.zone, golden.name).not.toBe("setAside");
      // Chief Turch came in at stage 3A and lies engaged with the first player.
      expect(cardsOf(state, "08014").map((card) => card.zone), golden.name).toEqual(["engaged"]);
      // No hero was destroyed: every seat still holds its three heroes.
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => !seat.eliminated && seat.heroes.length === 3), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.decks === "fragile") {
        // A hero was destroyed on stage 3B: the loss is the stage's own, after its last counter left.
        expect(codeOf(state, state.questStage), golden.name).toBe("08013");
        expect(state.cards[state.questStage ?? ""]?.resources, golden.name).toBe(0);
        expect(seats.some((seat) => seat.heroes.length < 3), golden.name).toBe(true);
      } else expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      if (golden.decks === "brittle") expect(seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

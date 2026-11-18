// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, dwd.setup-the-redhorn-gate, dwd.setup-the-redhorn-gate-set-aside, dwd.ally-objective-arwen, dwd.caradhras, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { victoryPointsOf } from "../../../rules/core/printed-stat.ts";

import { GATE_GOLDENS, playGolden, gateWorld, type GateDecks, type GateGolden } from "../../../../test/scenarios/the-redhorn-gate/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const gate = loadAnyScenario("the-redhorn-gate");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);

// A permanent golden: whole standalone games of The Redhorn Gate played by the auto-player (test/scenarios/the-redhorn-gate/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: the players quest through Snowdrifts (Caradhras becomes the active location at its defeat) and The Mountains' Peaks, which needs 5 victory points in the display before it is defeated.
// The losses are the four ways to lose here: every player's threat at 50 (heroes too weak to quest), every hero destroyed, Arwen discarded at 0 Willpower as stage 3B begins (committed, the Snowstorm and Caradhras take her to 0), and, on Nightmare, Snow-Giant discarding her.
// The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Redhorn Gate golden", () => {
  goldenSuite<GateGolden, GateDecks>({
    title: "The Redhorn Gate",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: gate,
    standalone: true,
    goldens: GATE_GOLDENS,
    world: gateWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1 with Caradhras in the staging area, 5 Snowstorms set aside, Arwen in play ready under the first player's control and, on Nightmare, the setup card with both Blinding Blizzards set aside",
      check(state, golden) {
        const nightmare = golden.difficulty === "Nightmare";
        expect(codeOf(state, state.questStage), golden.name).toBe("04011");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["04012", "04013"]);
        expect(cardsOf(state, "04015").map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, "04022").map((card) => card.zone), golden.name).toEqual(["setAside", "setAside", "setAside", "setAside", "setAside"]);
        const arwen = cardsOf(state, "04014");
        expect(arwen.map((card) => card.zone), golden.name).toEqual(["play"]);
        expect(arwen[0], golden.name).toMatchObject({ controller: state.firstPlayer, exhausted: false, face: "up" });
        expect(cardsOf(state, "901301").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
        expect(cardsOf(state, "901307").map((card) => card.zone), golden.name).toEqual(nightmare ? ["setAside", "setAside"] : []);
      },
    },
    wins: "ends when The Mountains' Peaks is defeated with 5 victory points in the display, settles at once with a score and earns nothing",
    won(state, golden, world) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "04013" ? "04013" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("04013");
      // 3B's bar: the display holds 5 victory points or more (on Nightmare the player cards in it count nothing), Caradhras among them when it was explored.
      const points = state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, world.ctx.cards), 0);
      expect(points, golden.name).toBeGreaterThanOrEqual(5);
      expect(cardsOf(state, "04014").map((card) => card.zone), golden.name).toEqual(["play"]);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Four ways to lose: the threat reached 50, no hero is left, or Arwen left play (the heroes are alive and the threat is low).
      if (golden.decks === "weak") {
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      } else if (golden.decks === "brittle") {
        expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      } else {
        expect(cardsOf(state, "04014").map((card) => card.zone).every((zone) => zone !== "play"), golden.name).toBe(true);
        expect(seats.every((seat) => seat.threat < 50 && seat.heroes.length > 0), golden.name).toBe(true);
        // Stage 3B discards her as it begins (a card of the encounter discard pile: she is an objective), Snow-Giant discards her from the first player's play area to his discard pile.
        expect(cardsOf(state, "04014")[0]?.zone, golden.name).toBe(golden.difficulty === "Nightmare" ? "discard" : "encounterDiscard");
        if (golden.difficulty !== "Nightmare") expect(codeOf(state, state.questStage), golden.name).toBe("04013");
      }
    },
  });
});

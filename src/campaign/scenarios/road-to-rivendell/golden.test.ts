// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, dwd.ambush, dwd.setup-road-to-rivendell, dwd.ally-objective-arwen-road-to-rivendell, rr.guarded, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { RIVENDELL_GOLDENS, playGolden, rivendellWorld, type RivendellDecks, type RivendellGolden } from "../../../../test/scenarios/road-to-rivendell/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const rivendell = loadAnyScenario("road-to-rivendell");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);

// A permanent golden: whole standalone games of Road to Rivendell played by the auto-player (test/scenarios/road-to-rivendell/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: Setup puts Arwen into play and each player reveals a card (Ambush makes its checks), the players quest through Along the Misty Mountains, Orc Outpost (Ambush in the Night on Nightmare, where Goblin Gate guards Arwen)
// and Approaching Rivendell, which wins when it is defeated. The losses are the ways to lose here: every player's threat at 50 (heroes too weak to quest), every hero destroyed, Arwen leaving play (solo and two-handed) and, on Nightmare, Arwen destroyed while Goblin Gate guards her.
// The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("Road to Rivendell golden", () => {
  goldenSuite<RivendellGolden, RivendellDecks>({
    title: "Road to Rivendell",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: rivendell,
    standalone: true,
    goldens: RIVENDELL_GOLDENS,
    world: rivendellWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1 with Arwen in play under the first player's control, Goblin Gate in the encounter deck or already revealed, a card revealed for each player and, on Nightmare, the setup card with Ambush in the Night in place of Orc Outpost",
      check(state, golden) {
        const nightmare = golden.difficulty === "Nightmare";
        expect(codeOf(state, state.questStage), golden.name).toBe("04038");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(nightmare ? ["901402", "04040"] : ["04039", "04040"]);
        const arwen = cardsOf(state, "04041");
        expect(arwen.map((card) => card.zone), golden.name).toEqual(["play"]);
        expect(arwen[0], golden.name).toMatchObject({ controller: state.firstPlayer, face: "up" });
        expect(cardsOf(state, "04043").length, golden.name).toBe(1);
        expect(cardsOf(state, "901401").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
        expect(cardsOf(state, "04039").map((card) => card.zone), golden.name).toEqual(nightmare ? [] : ["questDeck"]);
      },
    },
    wins: "ends when Approaching Rivendell is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "04040" ? "04040" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("04040");
      // Arwen is in play under a player's control, even on Nightmare where Goblin Gate held her until it left play.
      expect(cardsOf(state, "04041").map((card) => card.zone), golden.name).toEqual(["play"]);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Three ways to lose: the threat reached 50, no hero is left, or Arwen left play (the heroes are alive and the threat is low).
      if (golden.decks === "weak") {
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      } else if (golden.decks === "brittle") {
        expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      } else {
        const arwen = cardsOf(state, "04041")[0];
        expect(arwen?.zone, golden.name).not.toBe("play");
        expect(seats.every((seat) => seat.threat < 50 && seat.heroes.length > 0), golden.name).toBe(true);
        // Under Ambush in the Night she was guarded by Goblin Gate when she was destroyed.
        expect(["discard", "encounterDiscard"], golden.name).toContain(arwen?.zone);
        if (golden.difficulty === "Nightmare") expect(codeOf(state, state.questStage), golden.name).toBe("901402");
      }
    },
  });
});

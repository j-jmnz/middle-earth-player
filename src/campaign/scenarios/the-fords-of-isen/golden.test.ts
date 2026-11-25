// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, rm.time-x, rm.grima-objective-ally, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { ISEN_GOLDENS, playGolden, isenWorld, type IsenDecks, type IsenGolden } from "../../../../test/scenarios/the-fords-of-isen/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const isen = loadAnyScenario("the-fords-of-isen");
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Fords of Isen played by the auto-player (test/scenarios/the-fords-of-isen/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal and Easy: the players explore The Islet to free Gríma (stage 1B waits for him), survive the Time of Dunlending Attack and Hold the Fords, and defeat Hold the Fords once no enemy is in play.
// The losses are the two ways to lose here: Gríma leaves play (solo: heroes too weak to quest; two-handed: heroes too slow, so stage 1B's last time counter goes) and every hero destroyed (heroes too brittle). The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Fords of Isen golden", () => {
  goldenSuite<IsenGolden, IsenDecks>({
    title: "The Fords of Isen",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: isen,
    standalone: true,
    goldens: ISEN_GOLDENS,
    world: isenWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with 5 time counters on it, The Islet in the staging area with Gríma attached and one Dunland enemy added for each player, and stages 2 and 3 waiting in the quest deck",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("07059");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["07060", "07061"]);
        expect(state.cards[state.questStage ?? ""]?.resources, golden.name).toBe(5);
        const islet = cardsOf(state, "07017")[0];
        expect(islet?.zone, golden.name).toBe("staging");
        expect(cardsOf(state, "07016").map((card) => card.zone), golden.name).toEqual(["attached"]);
        expect(islet?.attachments, golden.name).toContain(cardsOf(state, "07016")[0]?.id);
        const dunland = cardsOf(state, "07042").concat(cardsOf(state, "07043"), cardsOf(state, "07044"), cardsOf(state, "07045"), cardsOf(state, "07046"), cardsOf(state, "07047"), cardsOf(state, "07048"), cardsOf(state, "07049"));
        expect(dunland.filter((card) => card.zone === "staging").length, golden.name).toBe(golden.seatCount);
      },
    },
    wins: "ends when Hold the Fords is defeated (the last enemy has left play), settles at once with a score and earns nothing",
    won(state, golden) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "07061" ? "07061" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("07061");
      // Gríma is in play and the players hold no enemy: 3B cannot be defeated otherwise.
      expect(cardsOf(state, "07016")[0]?.zone, golden.name).toBe("play");
      expect(Object.values(state.cards).filter((card) => card.type === "enemy" && (card.zone === "staging" || card.zone === "engaged")), golden.name).toEqual([]);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason === "Gríma left play") {
        // Stage 1B's last time counter went: nobody explored The Islet, and Gríma is out of play.
        expect(codeOf(state, state.questStage), golden.name).toBe("07059");
        expect(cardsOf(state, "07016")[0]?.zone, golden.name).not.toBe("play");
      } else expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

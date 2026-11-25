// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rm.out-of-play-deck, rm.mugash-player-card-backs, rm.time-x, rm.searches-x (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { pileOf } from "../../../rules/core/piles.ts";

import { ORC_GOLDENS, playGolden, orcWorld, type OrcDecks, type OrcGolden } from "../../../../test/scenarios/to-catch-an-orc/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const orc = loadAnyScenario("to-catch-an-orc");
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const outOfPlay = (state: ScenarioState, seat: 0 | 1) => pileOf(state, seat === 0 ? "outOfPlay0" : "outOfPlay1");

// A permanent golden: whole standalone games of To Catch an Orc played by the auto-player (test/scenarios/to-catch-an-orc/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal and Easy: the players search the out-of-play decks (Mugash lies in one), defeat Mugash, who attaches to a hero (the Guard engages that player), and defeat The Wizard's Prize with Mugash attached.
// The losses are the ways to lose here: the hero that holds Mugash leaves play (heroes too frail, every attack on the holder) and every hero destroyed (heroes too brittle), each solo and two-handed. The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("To Catch an Orc golden", () => {
  goldenSuite<OrcGolden, OrcDecks>({
    title: "To Catch an Orc",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: orc,
    standalone: true,
    goldens: ORC_GOLDENS,
    world: orcWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 2 (Searching for Mugash) with 2 time counters on it and stage 3 waiting, a Mountain location added to the staging area for each player, and each player's out-of-play deck holding 20 cards and one of Mugash and his Guards",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("07063");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["07064"]);
        expect(state.cards[state.questStage ?? ""]?.resources, golden.name).toBe(2);
        const dealt = [0, 1].slice(0, golden.seatCount).flatMap((seat) => outOfPlay(state, seat as 0 | 1).map((id) => codeOf(state, id)));
        expect(dealt.length, golden.name).toBe(21 * golden.seatCount);
        expect(dealt.filter((code) => code === "07024").length, golden.name).toBe(1);
        expect(dealt.filter((code) => code === "07025").length, golden.name).toBe(golden.seatCount - 1);
        expect(cardsOf(state, "07025").filter((card) => card.zone === "setAside").length, golden.name).toBe(4 - golden.seatCount);
      },
    },
    wins: "ends when The Wizard's Prize is defeated with Mugash attached to a hero, settles at once with a score and earns nothing",
    won(state, golden) {
      const ended = codeOf(state, state.questStage) === "07064" ? "07064" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("07064");
      // Progress cannot be placed on stage 3 unless Mugash is attached to a hero, so he lies on one.
      const mugash = cardsOf(state, "07024")[0];
      expect(mugash?.zone, golden.name).toBe("attached");
      expect(state.cards[mugash?.host ?? ""] && codeOf(state, mugash?.host), golden.name).toBeTruthy();
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason === "left play") {
        // The hero that held Mugash is gone, and Mugash is in the staging area or with his captor's discard.
        expect(cardsOf(state, "07024")[0]?.zone, golden.name).not.toBe("attached");
      } else expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

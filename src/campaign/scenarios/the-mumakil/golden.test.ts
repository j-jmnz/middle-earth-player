// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, hrd.setup-the-mumakil (data/rules/entries.json).
import { describe, expect } from "vitest";

import { MUMAKIL_GOLDENS, playGolden, mumakilWorld, type MumakilDecks, type MumakilGolden } from "../../../../test/scenarios/the-mumakil/game.ts";
import { CAPTURE_CODES, MUMAK, cardsOf, expectOpening } from "../../../../test/scenarios/the-mumakil/kit.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const mumakil = loadAnyScenario("the-mumakil");

// A permanent golden: whole standalone games of The Mûmakil played by the auto-player (test/scenarios/the-mumakil/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed: the players explore until their Wild Mûmak are in play (stage 1B), reach stage 2 where each player
// attaches a random Capture to a Mûmak, engage the Mûmakil (their engagement cost is 40, so the heroes start at a threat of 10 each) and use the Captures until none is in play. The losses are every player's threat at 50 and every player eliminated
// by destroyed heroes. Update the snapshot only when the change is meant.
describe("The Mûmakil golden", () => {
  goldenSuite<MumakilGolden, MumakilDecks>({
    title: "The Mûmakil",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: mumakil,
    standalone: true,
    goldens: MUMAKIL_GOLDENS,
    world: mumakilWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with the four Wild Mûmak and the four Captures set aside and one different location in the staging area for each player",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "17026", zone: "questStage" });
        expectOpening(state, golden.seatCount, golden.name);
      },
    },
    wins: "ends when stage 2B is defeated with no Capture in play, every Capture used, settles at once with a score and earns nothing",
    won(state, golden) {
      // Stage 2B cannot be defeated while a Capture is in play: each Capture is in the victory display with its Wild Mûmak, or in the encounter discard pile with a Mûmak that left.
      expect(state.stageCleared, golden.name).toBe(true);
      const captures = cardsOf(state, CAPTURE_CODES).filter((card) => card.zone !== "setAside");
      expect(captures.length, golden.name).toBe(golden.seatCount);
      expect(captures.every((card) => card.zone === "victory" || card.zone === "encounterDiscard"), golden.name).toBe(true);
      expect(captures.some((card) => card.zone === "victory"), golden.name).toBe(true);
      expect(cardsOf(state, [MUMAK]).some((card) => card.zone === "victory"), golden.name).toBe(true);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      if (golden.decks === "bold") expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      // The brittle heroes die: no seat reached a threat of 50.
      else expect(seats.every((seat) => seat.threat < 50), golden.name).toBe(true);
    },
  });
});

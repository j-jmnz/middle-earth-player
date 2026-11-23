// Rules: rr.setup, rr.first-player, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, hob.bilbo-baggins-otd, hob.venom-poison, hob.unconscious-characters, hob.staging-area-creating, hob.staging-area-combining, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { BILBO, SPIDERS_GOLDENS, playGolden, spidersWorld, type SpidersDecks, type SpidersGolden } from "../../../../test/scenarios/flies-and-spiders/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-hobbit");
const spiders = loadAnyScenario("flies-and-spiders");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Flies and Spiders played by the auto-player (test/scenarios/flies-and-spiders/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are one true solo and two-handed on Normal and Easy: the first player takes stage 3 with Bilbo Baggins (the other player takes stage 4 and, two-handed, defeats Battle with the Spiders after the first player joins it). The losses are the two ways to lose, true solo and
// two-handed: every player's threat at 50 and Bilbo Baggins leaving play. The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("Flies and Spiders golden", () => {
  goldenSuite<SpidersGolden, SpidersDecks>({
    title: "Flies and Spiders",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: spiders,
    standalone: true,
    goldens: SPIDERS_GOLDENS,
    world: spidersWorld,
    play: playGolden,
    opening: {
      title: "starts at Into Mirkwood with Bilbo Baggins in front of the first seat's heroes, The Spider's Glade set aside, a card revealed for each player and a Ring in the deck of each player",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("132067");
        expect(state.seats[0]?.heroes.map((id) => state.cards[id]?.code)[0], golden.name).toBe(BILBO);
        expect(cardsOf(state, BILBO).map((card) => card.zone), golden.name).toEqual(["heroes"]);
        expect(cardsOf(state, "132025").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        // Each player shuffled 1 copy of the Ring into his deck; the rest of the 4 copies wait set aside.
        const rings = cardsOf(state, "132019").map((card) => card.zone);
        expect(rings.filter((zone) => zone === "deck").length, golden.name).toBe(golden.seatCount);
        const staged = Object.values(state.cards).filter((card) => card.zone === "staging" || card.zone === "encounterDiscard" || card.zone === "engaged");
        expect(staged.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
      },
    },
    wins: "ends when Battle with the Spiders is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("132070");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Bilbo Baggins out of the heroes, or every seat eliminated at threat 50: one assertion either way.
      const byBilbo = golden.lossReason === "Bilbo Baggins left play";
      expect(byBilbo ? cardsOf(state, BILBO).every((card) => card.zone !== "heroes") : seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
    },
  });
});

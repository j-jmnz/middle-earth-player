// Rules: rr.setup, rr.active-location, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { OSGILIATH_GOLDENS, playGolden, osgiliathWorld, type OsgiliathDecks, type OsgiliathGolden } from "../../../../test/scenarios/the-massing-at-osgiliath/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const osgiliath = loadAnyScenario("the-massing-at-osgiliath");
const SCOUTS = ["00002", "00003", "00004"];
const cardsOf = (state: ScenarioState, ...codes: string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));

// A permanent golden: whole standalone games of The Massing at Osgiliath played by the auto-player (test/scenarios/the-massing-at-osgiliath/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and on Easy (the quest goes a stage a round: Beyond Expectations, Through the Ruins, Anduin Crossing, whose
// cost a hero pays, then Race to Minas Tirith, where the Witch-king joins the staging area); the losses are the two ways the scenario is lost: every player's threat at 50 and every hero destroyed. Update the snapshot only when the change is meant.
describe("The Massing at Osgiliath golden", () => {
  goldenSuite<OsgiliathGolden, OsgiliathDecks>({
    title: "The Massing at Osgiliath",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: osgiliath,
    standalone: true,
    goldens: OSGILIATH_GOLDENS,
    world: osgiliathWorld,
    play: playGolden,
    opening: {
      title: "starts at Beyond Expectations with three Scouts for each player in the staging area (one of each title), the Witch-king set aside, the Rangers of Ithilien in the encounter deck and the later stages in the quest deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("00016");
        expect(cardsOf(state, "00001").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        // Setup (00016:A:1) put one of each Scout title for each player into the staging area; the unused Scouts went back into the deck.
        const staged = cardsOf(state, "00002", "00003", "00004").filter((card) => card.zone === "staging");
        expect(staged.length, golden.name).toBe(3 * golden.seatCount);
        for (const code of SCOUTS) expect(staged.filter((card) => card.code === code).length, `${golden.name} ${code}`).toBe(golden.seatCount);
        // Easy deals the Normal deck: both Rangers of Ithilien are in the encounter deck either way.
        expect(cardsOf(state, "00015").filter((card) => card.zone === "encounterDeck").length, golden.name).toBe(2);
        expect(["00017", "00018", "00019"].map((code) => cardsOf(state, code).map((card) => card.zone)), golden.name).toEqual([["questDeck"], ["questDeck"], ["questDeck"]]);
      },
    },
    wins: "ends when Race to Minas Tirith is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("00019");
      // The Witch-king joined the staging area when stage 4 was revealed (00019:B:1) and no player is eliminated.
      expect(cardsOf(state, "00001").length, golden.name).toBe(1);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Two ways to be eliminated: the threat reached 50, or no hero is left.
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});

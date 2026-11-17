// Rules: rr.setup, rr.active-location, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { CARROCK_GOLDENS, playGolden, carrockWorld, type CarrockDecks, type CarrockGolden } from "../../../../test/scenarios/conflict-at-the-carrock/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("shadows-of-mirkwood");
const carrock = loadAnyScenario("conflict-at-the-carrock");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const TROLLS = ["02038", "02039", "02040", "02041"];
const NIGHTMARE_TROLLS = ["900504", "900505", "900506", "900507"];

// A permanent golden: whole standalone games of Conflict at the Carrock played by the auto-player (test/scenarios/conflict-at-the-carrock/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: Grimbeorn's Quest makes The Carrock the active location, Against the Trolls brings the four unique Trolls out, the players engage Louis first and defeat them one each, and on Normal and Easy
// defeating the stage wins; on Nightmare Grimbeorn's Folly follows it and the game ends when Rob and Bob is defeated. The losses are the two ways the scenario is lost: every player's threat at 50 and every hero destroyed. The opening, the causes, a replay and the scoring are
// checked for each. Update the snapshot only when the change is meant.
describe("Conflict at the Carrock golden", () => {
  goldenSuite<CarrockGolden, CarrockDecks>({
    title: "Conflict at the Carrock",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: carrock,
    standalone: true,
    goldens: CARROCK_GOLDENS,
    world: carrockWorld,
    play: playGolden,
    opening: {
      title: "starts at Grimbeorn's Quest with The Carrock in the staging area, the unique Trolls set aside, a Sacked! shuffled into the encounter deck for each player and the later stages in the quest deck",
      check(state, golden) {
        const nightmare = golden.difficulty === "Nightmare";
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("02035");
        expect(cardsOf(state, "02036").map((card) => card.zone), golden.name).toEqual(["questDeck"]);
        expect(cardsOf(state, "02043").map((card) => card.zone), golden.name).toEqual(["staging"]);
        // The four unique Trolls wait out of play (Nightmare: its own four, and Rob and Bob as a fifth, 900501:A:2).
        for (const code of nightmare ? NIGHTMARE_TROLLS : TROLLS) expect(cardsOf(state, code).map((card) => card.zone), `${golden.name} ${code}`).toEqual(["setAside"]);
        expect(cardsOf(state, "900503").map((card) => card.zone), golden.name).toEqual(nightmare ? ["setAside"] : []);
        // Setup shuffled one Sacked! for each player into the encounter deck; the printed deck holds one more on Normal and Nightmare, none on Easy.
        const sacked = cardsOf(state, "02048").filter((card) => card.zone === "encounterDeck").length;
        expect(sacked, golden.name).toBe(golden.seatCount + (golden.difficulty === "Easy" ? 0 : 1));
        expect(cardsOf(state, "900501").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
      },
    },
    wins: "ends when Against the Trolls is defeated (Normal, Easy) or Rob and Bob is defeated at Grimbeorn's Folly (Nightmare), settles at once with a score and earns nothing",
    won(state, golden) {
      const nightmare = golden.difficulty === "Nightmare";
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(nightmare ? "900511" : "02036");
      // Every unique Troll was defeated on the way: each lies in the victory display (or, defeated at the end, in the discard pile that holds it).
      for (const code of nightmare ? [...NIGHTMARE_TROLLS, "900503"] : TROLLS) expect(cardsOf(state, code).every((card) => card.zone === "victory" || card.zone === "encounterDiscard"), `${golden.name} ${code}`).toBe(true);
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

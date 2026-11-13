// Rules: mec108.setup-the-weather-hills, mec108.campaign-setup-the-weather-hills, mec108.orc-deck, mec108.side-quests, mec108.time-x, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { HILLS_GOLDENS, playGolden, hillsWorld, type HillsDecks, type HillsGolden } from "../../../../test/scenarios/the-weather-hills/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("angmar-awakened");
const hills = loadScenario("the-weather-hills");
const HUNT = "09071";
const SAVAGE = "09072";
const AMON_FORN = "09026";
const PROTECT = "10158";
const OMENS = "10160";
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);

// A permanent golden: whole games of The Weather Hills in Campaign Mode played by the auto-player (test/scenarios/the-weather-hills/game.ts) on fixed seeds, true solo and two-handed, through wins (the default answers, every choice the first option, one character defending and one questing) and the ways to lose: Protect the Innocent holding 10 damage, Savage Counter-attack holding no token, the players' threat at 50 and every hero destroyed. It pins the path from data/ through the campaign card's Setup
// (Scattered Among the Hills as stage 1, Hunting the Orcs and a Weathered Hilltop in the staging area, Exposed Ridge active, Orc Ambush and Amon Forn set aside, the Orc deck dealt, Protect the Innocent staged and Mysterious Omens in the encounter deck), the
// flip of Hunting the Orcs to Savage Counter-attack that advances the quest to stage 2, and the Resolution that notes the damage on Protect the Innocent. Update the snapshot only when the change is meant.
describe("The Weather Hills golden", () => {
  goldenSuite<HillsGolden, HillsDecks>({
    title: "The Weather Hills",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: hills,
    goldens: HILLS_GOLDENS,
    world: hillsWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1 with Hunting the Orcs, a Weathered Hilltop and Protect the Innocent in the staging area, Exposed Ridge active, Orc Ambush and Amon Forn set aside, the Orc deck dealt and Mysterious Omens in the encounter deck",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("09069");
        expect(zonesOf(state, HUNT), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, "09027"), golden.name).toContain("staging");
        // The campaign card's Setup stages Protect the Innocent from the pool (one card, no copy in a deck) and shuffles Mysterious Omens in.
        expect(zonesOf(state, PROTECT), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, "09028"), golden.name).toContain("activeLocation");
        expect(zonesOf(state, AMON_FORN), golden.name).toEqual(["setAside"]);
        expect(zonesOf(state, "09046"), golden.name).toEqual(["setAside"]);
        expect(state.piles?.angmarOrcDeck?.length ?? 0, golden.name).toBeGreaterThan(0);
        expect(zonesOf(state, OMENS), golden.name).toEqual(["encounterDeck"]);
        expect(cardsOf(state, PROTECT)[0]?.damage ?? 0, golden.name).toBe(0);
      },
    },
    wins: "wins when stage 2B is defeated with Amon Forn out of play (stage 1 advances when Hunting the Orcs flips), runs 10159's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("09070");
      expect(zonesOf(state, SAVAGE).filter((zone) => zone === "staging"), golden.name).toHaveLength(1);
      expect(cardsOf(state, SAVAGE)[0]?.resources, golden.name).toBeGreaterThan(0);
      expect(zonesOf(state, HUNT), golden.name).toEqual([]);
      expect(zonesOf(state, AMON_FORN).filter((zone) => zone === "staging" || zone === "activeLocation"), golden.name).toEqual([]);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    afterWin({ state, golden, log }) {
      // 10159:B:1: the damage on Protect the Innocent is noted in the log; Mysterious Omens is undefeated, so no boon is earned.
      expect(log.protectDamage, golden.name).toBe(cardsOf(state, PROTECT)[0]?.damage ?? 0);
      expect(log.campaignPool.filter((card) => card.attachedTo != null), golden.name).toEqual([]);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats and each way to lose", () => {
        const won = HILLS_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(1);
        const lost = HILLS_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const reason of ["Protect the Innocent holds 10 damage", "Savage Counter-attack held no resource token", "No seats remain"]) expect(lost.some((golden) => golden.lossReason === reason), reason).toBe(true);
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("10158:A:3 a lost game on 10 damage holds exactly 10 on Protect the Innocent", () => {
        const golden = HILLS_GOLDENS.find((item) => item.lossReason === "Protect the Innocent holds 10 damage")!;
        expect(cardsOf(game(golden).state, PROTECT)[0]?.damage).toBe(10);
      });

      it("09072:A:3 a game that lost on Savage Counter-attack had flipped Hunting the Orcs, and the card holds no token", () => {
        const golden = HILLS_GOLDENS.find((item) => item.lossReason === "Savage Counter-attack held no resource token")!;
        const state = game(golden).state;
        expect(cardsOf(state, SAVAGE)[0]?.resources).toBe(0);
        expect(state.cards[state.questStage ?? ""]?.code).toBe("09070");
      });

      it("09072:A:1 a won game flipped Hunting the Orcs at 3 more tokens than the players, so Savage Counter-attack came into play holding at least that many", () => {
        const golden = HILLS_GOLDENS.find((item) => item.name === "true solo, won, Normal")!;
        const state = game(golden).state;
        expect(cardsOf(state, SAVAGE)).toHaveLength(1);
        expect(cardsOf(state, HUNT)).toHaveLength(0);
      });
    },
  });
});

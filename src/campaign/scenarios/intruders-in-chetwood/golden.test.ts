// Rules: mec108.setup-intruders-in-chetwood, mec108.campaign-setup-intruders-in-chetwood, mec108.objective-allies, mec108.side-quests, mec108.time-x, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { CHETWOOD_GOLDENS, playGolden, chetwoodWorld, type ChetwoodDecks, type ChetwoodGolden } from "../../../../test/scenarios/intruders-in-chetwood/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("angmar-awakened");
const chetwood = loadScenario("intruders-in-chetwood");
const IARION = "09016";
const PENDANT = "10157";
const PROTECT = "10158";
const RESCUE = "09024";
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole games of Intruders in Chetwood in Campaign Mode played by the auto-player (test/scenarios/intruders-in-chetwood/game.ts) on fixed seeds, true solo and two-handed, through wins (Normal and Easy, with the players defending
// and questing with one hero, or answering every choice with its first option) and the ways to lose: Protect the Innocent holding 10 damage, Iârion leaving play (Rescue Iârion's last time counter, Angmar Orc's discard), the players' threat at 50 and every hero
// destroyed. It pins the path from data/ through the campaign card's Setup (Stop the War Party as stage 1, Iârion in play under the first player with his Pendant, Protect the Innocent in the staging area, the Orc War Party and a location for each player),
// no engagement checks, the Orc War Parties that must leave play before the stage can be defeated, and the Resolution that notes the damage on Protect the Innocent. Update the snapshot only when the change is meant.
describe("Intruders in Chetwood golden", () => {
  goldenSuite<ChetwoodGolden, ChetwoodDecks>({
    title: "Intruders in Chetwood",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: chetwood,
    goldens: CHETWOOD_GOLDENS,
    world: chetwoodWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1 with Iârion in play under the first player and his Pendant on him, Protect the Innocent and an Orc War Party in the staging area with a location for each player, and each player's trade of 4 damage made",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("09068");
        const iarion = cardsOf(state, IARION);
        expect(iarion.map((card) => [card.zone, card.controller]), golden.name).toEqual([["play", state.firstPlayer]]);
        expect(cardsOf(state, PENDANT).map((card) => [card.zone, card.host]), golden.name).toEqual([["play", iarion[0]?.id]]);
        const protect = cardsOf(state, PROTECT);
        expect(protect.map((card) => card.zone), golden.name).toEqual(["staging"]);
        // The default answer of the Setup's question is the trade, for each player in turn.
        expect(protect[0]?.damage, golden.name).toBe(4 * golden.seatCount);
        for (const seat of state.seats.slice(0, golden.seatCount)) for (const id of seat.heroes) expect(state.cards[id]?.resources, golden.name).toBeGreaterThanOrEqual(1);
        expect(cardsOf(state, "09017").map((card) => card.zone), golden.name).toContain("staging");
        const locations = state.staging.filter((id) => state.cards[id]?.code !== "09017" && state.cards[id]?.code !== PROTECT);
        expect(locations.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
      },
    },
    wins: "wins when no Orc War Party is in play and the first player controls Iârion, runs 10156's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("09068");
      expect(cardsOf(state, IARION).map((card) => card.zone), golden.name).toEqual(["play"]);
      expect(cardsOf(state, "09017").filter((card) => card.zone === "staging" || card.zone === "engaged"), golden.name).toEqual([]);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    afterWin({ state, golden, log }) {
      // 10156:B:1: the damage on Protect the Innocent is noted in the log and the card joins the campaign pool.
      expect(log.protectDamage, golden.name).toBe(cardsOf(state, PROTECT)[0]?.damage);
      expect(log.campaignPool.filter((card) => card.code === PROTECT), golden.name).toHaveLength(1);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy, the trade, and each way to lose", () => {
        const won = CHETWOOD_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        const lost = CHETWOOD_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const reason of ["Protect the Innocent holds 10 damage", "Iârion left play", "No seats remain"]) expect(lost.some((golden) => golden.lossReason === reason), reason).toBe(true);
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("10158:A:3 a lost game on 10 damage holds exactly 10 on Protect the Innocent", () => {
        const golden = CHETWOOD_GOLDENS.find((item) => item.lossReason === "Protect the Innocent holds 10 damage")!;
        expect(cardsOf(game(golden).state, PROTECT)[0]?.damage).toBe(10);
      });

      it("09024:A:3 a game that ran out of time lost with the Time card at no counters, and Iârion discarded from under it", () => {
        const golden = CHETWOOD_GOLDENS.find((item) => item.name === "two-handed, lost, Rescue Iârion runs out of time")!;
        const state = game(golden).state;
        const rescue = cardsOf(state, RESCUE)[0];
        expect(rescue?.resources).toBe(0);
        expect(cardsOf(state, IARION).map((card) => card.zone)).toEqual(["encounterDiscard"]);
      });

      it("09043:A:1 a game that discarded Iârion to Angmar Orc lost with him in the discard pile", () => {
        const golden = CHETWOOD_GOLDENS.find((item) => item.name === "two-handed, lost, Angmar Orc discards Iârion")!;
        const state = game(golden).state;
        expect(cardsOf(state, IARION).map((card) => card.zone)).toEqual(["discard"]);
        expect(cardsOf(state, "09043").length).toBeGreaterThan(0);
      });
    },
  });
});

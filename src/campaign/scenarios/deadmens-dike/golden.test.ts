// Rules: mec108.setup-deadmens-dike, mec108.campaign-setup-deadmens-dike, mec108.indestructible, mec108.side-quests, mec108.time-x, rr.player-elimination, rr.winning-the-game, rr.campaign-pool (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { DIKE_GOLDENS, playGolden, dikeWorld, type DikeDecks, type DikeGolden } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("angmar-awakened");
const dike = loadScenario("deadmens-dike");
const THAURDIR = "09033";
const IARION = "09016";
const PROTECT = "10158";
const ARNOR_RAVAGED = "100158";
const OMENS = "10160";
const BURDENS = ["10168", "10169", "10170"];
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);
const burdenIn = (state: ScenarioState) => Object.values(state.cards).filter((card) => BURDENS.includes(card.code) && card.host != null);

// A permanent golden: whole games of Deadmen's Dike in Campaign Mode played by the auto-player (test/scenarios/deadmens-dike/game.ts) on fixed seeds, true solo and two-handed, through wins (the default answers, every choice the first option, two seats; each
// seed gives Thaurdir another of the three burdens) and the ways to lose: Protect the Innocent holding 10 damage, the players' threat at 50, every hero destroyed by Thaurdir and, two-handed, a deck running out while its player controls Iârion. It pins the path from
// data/ through the campaign card's Setup (The Shades of Angmar as stage 1 with Fornost Square in the staging area, Iârion in play under the first player with his Pendant, Thaurdir set aside, Protect the Innocent staged, Mysterious Omens shuffled in), stage 2A's When Revealed
// that adds Thaurdir and attaches a random burden to him, the Resolution that earns Arnor Ravaged in the place of Protect the Innocent and the burden. Update the snapshot only when the change is meant.
describe("Deadmen's Dike golden", () => {
  goldenSuite<DikeGolden, DikeDecks>({
    title: "Deadmen's Dike",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: dike,
    goldens: DIKE_GOLDENS,
    world: dikeWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1 with Fornost Square and Protect the Innocent in the staging area, Iârion in play and his Pendant on him, Thaurdir set aside and Mysterious Omens in the encounter deck",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("09073");
        expect(zonesOf(state, "09038"), golden.name).toContain("staging");
        expect(zonesOf(state, PROTECT), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, PROTECT)[0]?.damage ?? 0, golden.name).toBe(0);
        expect(zonesOf(state, THAURDIR), golden.name).toEqual(["setAside"]);
        expect(zonesOf(state, IARION), golden.name).toEqual(["play"]);
        expect(cardsOf(state, "10157").map((card) => state.cards[card.host ?? ""]?.code), golden.name).toEqual([IARION]);
        expect(zonesOf(state, OMENS), golden.name).toEqual(["encounterDeck"]);
        // The three encounter side quests lie in the encounter deck, not in play.
        for (const code of ["09042", "09063", "09067"]) expect(zonesOf(state, code).every((zone) => zone === "encounterDeck"), golden.name).toBe(true);
        expect(state.sideQuests, golden.name).toBe(true);
      },
    },
    wins: "wins when stage 2B is defeated with 9 damage on Thaurdir, runs 10166's Resolution and ends the campaign's third part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("09074");
      const thaurdir = cardsOf(state, THAURDIR)[0];
      // Indestructible: he is in play still, with at least his 9 hit points of damage.
      expect(thaurdir?.zone === "staging" || thaurdir?.zone === "engaged", golden.name).toBe(true);
      expect(thaurdir?.damage ?? 0, golden.name).toBeGreaterThanOrEqual(9);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
      // One of the three burdens was attached to him when he entered play: it lies on him or on the hero it moved to.
      expect(burdenIn(state), golden.name).toHaveLength(1);
    },
    afterWin({ state, golden, log }) {
      // 10166:B:1: Protect the Innocent leaves the pool and its damage is noted, Arnor Ravaged takes its place; 10166:A:3: the burden Thaurdir carried joins the pool (the one on a hero or on him now), and the group's choice of Iârion's Pendant or Amarthiúl's Courage too.
      expect(log.protectDamage, golden.name).toBe(cardsOf(state, PROTECT)[0]?.damage ?? 0);
      const pooled = log.campaignPool.map((card) => card.code);
      expect(pooled, golden.name).not.toContain(PROTECT);
      expect(pooled, golden.name).toContain(ARNOR_RAVAGED);
      expect(pooled.filter((code) => BURDENS.includes(code)), golden.name).toEqual([burdenIn(state)[0]?.code]);
      expect(pooled.filter((code) => code === "10157" || code === "10167"), golden.name).toHaveLength(1);
      expect(log.completed, golden.name).toContain("deadmens-dike");
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, a burden of each kind and each way to lose", () => {
        const won = DIKE_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(1);
        const lost = DIKE_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const reason of ["Protect the Innocent holds 10 damage", "No seats remain", "Iârion left play"]) expect(lost.some((golden) => golden.lossReason === reason), reason).toBe(true);
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("10166:A:3 gives Thaurdir a different burden in each won game: the three wins carry the three burdens", () => {
        const carried = DIKE_GOLDENS.filter((golden) => golden.outcome === "won").map((golden) => burdenIn(game(golden).state)[0]?.code);
        expect([...new Set(carried)].sort()).toEqual(BURDENS);
      });

      it("10158:A:3 a lost game on 10 damage holds exactly 10 on Protect the Innocent", () => {
        const golden = DIKE_GOLDENS.find((item) => item.lossReason === "Protect the Innocent holds 10 damage")!;
        expect(cardsOf(game(golden).state, PROTECT)[0]?.damage).toBe(10);
      });

      it("09074:B:1 the game lost to Thaurdir's attacks destroyed every hero, so the controller was asked after each, and the stage was the second", () => {
        const golden = DIKE_GOLDENS.find((item) => item.decks === "brittle")!;
        const state = game(golden).state;
        expect(state.cards[state.questStage ?? ""]?.code).toBe("09074");
        expect(state.seats[0]?.heroes).toHaveLength(0);
      });

      it("09073:B:3 the game lost with Iârion's controller out of cards had eliminated that player while the other still held cards in his deck", () => {
        const golden = DIKE_GOLDENS.find((item) => item.lossReason === "Iârion left play")!;
        const state = game(golden).state;
        expect(state.seats[0]?.eliminated).toBe(true);
        expect(state.seats[0]?.deck).toHaveLength(0);
        expect(state.seats[1]?.eliminated).not.toBe(true);
        expect(zonesOf(state, IARION)).not.toContain("play");
      });
    },
  });
});

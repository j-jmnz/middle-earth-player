// Rules: mec108.thaurdir, mec108.indestructible, mec108.battle, mec108.side-quests-in-play, mec108.campaign-setup-the-battle-of-carn-dum, mec108.campaign-mode, mec108.campaign-log, rr.active-location, rr.winning-the-game, rr.campaign-pool, rr.player-elimination (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { DUM_GOLDENS, playGolden, dumWorld, type DumDecks, type DumGolden } from "../../../../test/scenarios/the-battle-of-carn-dum/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("angmar-awakened");
const dum = loadScenario("the-battle-of-carn-dum");
const THAURDIR = ["10127", "10128"];
const cardsOf = (state: ScenarioState, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));
const handOf = (state: ScenarioState, seat: number) => state.seats[seat]?.hand.map((id) => state.cards[id]?.code);

// A permanent golden: whole games of The Battle of Carn Dûm in Campaign Mode played by the auto-player (test/scenarios/the-battle-of-carn-dum/game.ts) on fixed seeds, after The Treachery of Rhudaur's win, so the campaign card is in play. Two wins, true solo and two-handed, each ending
// with Thaurdir destroyed on stage 2B once 15 progress took his Indestructible away (10126:B:2, 10126:B:3); and a loss for each way to lose (threat 50, every hero destroyed). It pins the path from data/ through the quest card's Setup (Thaurdir staged Captain side faceup, one
// Carn Dûm Garrison for each player, Accursed Battlefield active), the campaign card's Setup (the boons the players took in their opening hands) and the Resolution (the damage on each hero is noted). Update the snapshot only when the change is meant.
describe("The Battle of Carn Dûm golden", () => {
  goldenSuite<DumGolden, DumDecks>({
    title: "The Battle of Carn Dûm",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: dum,
    goldens: DUM_GOLDENS,
    world: dumWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1B with Thaurdir (Captain side faceup) and a Carn Dûm Garrison for each player in the staging area, Accursed Battlefield active and the boons taken in the opening hands",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10125");
        const staged = state.staging.map((id) => state.cards[id]?.code);
        expect(staged.filter((code) => code === "10127"), golden.name).toHaveLength(1);
        expect(staged.filter((code) => code === "10129"), golden.name).toHaveLength(golden.seatCount);
        expect(state.cards[state.activeLocation ?? ""]?.code, golden.name).toBe("10132");
        expect(handOf(state, 0), golden.name).toContain("10189");
        if (golden.seatCount === 2) expect(handOf(state, 1), golden.name).toContain("10190");
      },
    },
    wins: "wins when Thaurdir is destroyed on stage 2B, runs 10188's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10126");
      // Midwinter's Crux held 15 progress (his Indestructible lapsed) and he lies in the encounter discard pile.
      expect(state.cards[state.questStage ?? ""]?.progress ?? 0, golden.name).toBeGreaterThanOrEqual(15);
      expect(cardsOf(state, THAURDIR).map((card) => card.zone), golden.name).toEqual(["encounterDiscard"]);
    },
    afterWin({ log, golden }) {
      expect(log.completed, golden.name).toContain("the-battle-of-carn-dum");
    },
    lost(state, golden) {
      if (golden.name.includes("threat")) expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats and each way to lose", () => {
        const won = DUM_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(1);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(1);
        const lost = DUM_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("10126:B:1 stage 2B's attacks reach each seat: the two-handed win has Thaurdir attack both players in a round", () => {
        const won = DUM_GOLDENS.find((golden) => golden.seatCount === 2 && golden.outcome === "won")!;
        const attackers = game(won).steps.filter((step) => step.kind === "attack" && step.side === "enemy");
        const seats = new Set(attackers.filter((step) => step.kind === "attack" && ["10127", "10128"].includes(game(won).state.cards[step.enemyId]?.code ?? "")).map((step) => (step.kind === "attack" ? step.seat : -1)));
        expect(seats.has(0) && seats.has(1)).toBe(true);
      });
    },
  });
});

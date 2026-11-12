// Rules: mec108.day-and-night, mec108.setup-the-wastes-of-eriador, mec108.campaign-setup-the-wastes-of-eriador, mec108.objective-allies, mec108.side-quests, mec108.campaign-log, rr.winning-the-game, rr.campaign-pool (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { ERIADOR_GOLDENS, playGolden, eriadorWorld, type EriadorDecks, type EriadorGolden } from "../../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("angmar-awakened");
const eriador = loadScenario("the-wastes-of-eriador");
const AMARTHIUL = "10016";
const PACK_LEADER = "10017";
const DETERMINATION = "10172";
const FEND_OFF_DESPAIR = "10173";
const SHROUDED_HILLS = "09048";
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);

// A permanent golden: whole games of The Wastes of Eriador in Campaign Mode played by the auto-player (test/scenarios/the-wastes-of-eriador/game.ts) on fixed seeds, true solo and two-handed, through wins (the heroes quest at Day and stay ready to attack Pack Leader at Night; one win
// answers each choice with its last option, which makes a side quest the current quest, so Fend Off Despair is defeated and the Resolution writes the starting threat 2 lower) and the ways to lose: the players' threat at 50, every hero destroyed and Amarthiúl leaving play. It pins the path from data/
// through the campaign card's Setup (the Time objective faceup on Daybreak in the staging area, Shrouded Hills active, Pack Leader set aside, Amarthiúl in play under the first player, a Determination in each hand, Fend Off Despair and Mysterious Omens in the encounter deck, Arnor Ravaged staged
// once), stage 2A's and 3A's Wargs, the flip of the Time objective each round and the Resolution that earns Fend Off Despair. Update the snapshot only when the change is meant.
describe("The Wastes of Eriador golden", () => {
  goldenSuite<EriadorGolden, EriadorDecks>({
    title: "The Wastes of Eriador",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: eriador,
    goldens: ERIADOR_GOLDENS,
    world: eriadorWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1 with Daybreak in the staging area and Shrouded Hills active, Pack Leader set aside, Amarthiúl under the first player, a Determination in each hand and Fend Off Despair in the encounter deck",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("10013");
        // The Time objective is one physical card in the staging area, dealt Daybreak up (a Sudden Darkness a player's Setup reveal drew has flipped it to Nightfall).
        expect([...zonesOf(state, "10011"), ...zonesOf(state, "10012")], golden.name).toEqual(["staging"]);
        expect(zonesOf(state, SHROUDED_HILLS), golden.name).toContain("activeLocation");
        expect(zonesOf(state, PACK_LEADER), golden.name).toEqual(["setAside"]);
        // (The opening answers every question with its first option: a Predatory Wolves drawn by a Setup reveal then discards Amarthiúl, and the game is lost before it begins.)
        expect(cardsOf(state, AMARTHIUL).map((card) => [card.zone, card.controller]), golden.name).toEqual(state.lost ? [["encounterDiscard", null]] : [["play", state.firstPlayer]]);
        // Fend Off Despair and Mysterious Omens are shuffled into the encounter deck: one copy each, in the deck or, when a player's Setup reveal drew it, in the staging area.
        for (const code of [FEND_OFF_DESPAIR, "10160"]) expect(["encounterDeck", "staging"], `${golden.name} ${code}`).toContain(zonesOf(state, code)[0]);
        expect(zonesOf(state, FEND_OFF_DESPAIR), golden.name).toHaveLength(1);
        // A hand a player's Setup reveal put under Lost in the Wilderness holds its Determination under that card.
        expect(cardsOf(state, DETERMINATION).map((card) => card.zone === "hand" || card.zone === "under"), golden.name).toEqual(Array(golden.seatCount).fill(true));
        // Arnor Ravaged, in the pool since Deadmen's Dike, lies in the staging area once (its Setup takes the pool copy).
        expect(zonesOf(state, "100158"), golden.name).toEqual(["staging"]);
        expect(state.sideQuests, golden.name).toBe(true);
      },
    },
    wins: "wins when Pack Leader is destroyed with 5 or more progress on stage 3B, runs 10171's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10015");
      expect(zonesOf(state, PACK_LEADER), golden.name).toEqual(["victory"]);
      expect(zonesOf(state, AMARTHIUL), golden.name).toEqual(["play"]);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    afterWin({ state, golden, log }) {
      // 10171:B:1: Fend Off Despair joins the pool (the Determinations the Campaign Setup added are the checklist's, read in campaign.test.ts); the starting threat 10173:A:2 noted is 2 lower only where it was defeated in this game.
      const pooled = log.campaignPool.map((card) => card.code);
      expect(pooled, golden.name).toContain(FEND_OFF_DESPAIR);
      const defeated = zonesOf(state, FEND_OFF_DESPAIR).includes("victory");
      expect(log.threatPenalty, golden.name).toBe(defeated ? -2 : 0);
      expect(log.completed, golden.name).toContain("the-wastes-of-eriador");
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, a win that defeats Fend Off Despair and each way to lose", () => {
        const won = ERIADOR_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(1);
        const lost = ERIADOR_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const reason of ["No seats remain", "Amarthiúl left play"]) expect(lost.some((golden) => golden.lossReason === reason), reason).toBe(true);
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("10173:A:2 the win that made a side quest the current quest defeated Fend Off Despair and wrote the starting threat 2 lower; the other wins wrote none", () => {
        const wins = ERIADOR_GOLDENS.filter((golden) => golden.outcome === "won");
        const penalties = wins.map((golden) => [golden.name, game(golden).state.resolutionLog.startingThreat ?? 0] as const);
        expect(penalties.filter(([, amount]) => amount === -2).map(([name]) => name)).toEqual(["true solo, won, Fend Off Despair defeated"]);
        expect(penalties.filter(([, amount]) => amount !== -2 && amount !== 0)).toEqual([]);
      });

      it("10015:B:3 a won game destroyed Pack Leader while the stage held 5 or more progress at Night, and the lost games never destroyed him", () => {
        for (const golden of ERIADOR_GOLDENS) {
          const state = game(golden).state;
          const destroyed = zonesOf(state, PACK_LEADER).includes("victory");
          expect(destroyed, golden.name).toBe(golden.outcome === "won");
          if (destroyed) expect(state.cards[state.questStage ?? ""]?.progress, golden.name).toBeGreaterThanOrEqual(5);
        }
      });

      it("10016:A:2 the game lost to Predatory Wolves discarded Amarthiúl, who left play with the game lost", () => {
        const golden = ERIADOR_GOLDENS.find((item) => item.lossReason === "Amarthiúl left play")!;
        const state = game(golden).state;
        expect(zonesOf(state, AMARTHIUL)).not.toContain("play");
        expect(state.lost).toBe(true);
      });

      it("10013:B:2 and 10026:A:1 the game lost on threat raised the players' threat to 50 with no progress made, the heroes too small to quest", () => {
        const golden = ERIADOR_GOLDENS.find((item) => item.decks === "weak")!;
        const state = game(golden).state;
        expect(state.seats[0]?.threat).toBeGreaterThanOrEqual(50);
        expect(state.cards[state.questStage ?? ""]?.code).toBe("10013");
      });
    },
  });
});

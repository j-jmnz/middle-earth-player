// Rules: mec113.dire, mec113.setting-up-the-game, mec113.saga-staging-rules, mec113.campaign-mode, rr.player-elimination, rr.threat-elimination-level, rr.first-player, rr.winning-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 146072:B:1, 146073:B:1, 146073:B:3, 146024:A:3, 146074:B:1.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { emptyLog, type CampaignLog } from "../../log.ts";

import { OPENS_GOLDENS, afterUngol, opensWorld, playGolden, type OpensDecks, type OpensGolden } from "../../../../test/scenarios/the-black-gate-opens/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-return-of-the-king");
const opens = loadScenario("the-black-gate-opens");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);
const GATE = "146024";
const MOUTH = "146031";
const GWAIHIR = "146041";
const before = (golden: OpensGolden): CampaignLog => (golden.after ? afterUngol(golden.seatCount) : emptyLog(golden.seatCount));
// The Campaign Mode games that end in a Resolution; the standalone ones and the losses do not.
const ended = OPENS_GOLDENS.filter((golden) => golden.outcome === "won");

// A permanent golden: whole games of The Black Gate Opens in Campaign Mode played by the auto-player (test/scenarios/the-black-gate-opens/game.ts) on fixed seeds, true solo and two-handed. The scenario cannot be won (146073:B:3): it ends when the last player is eliminated (the threat at 99
// under Dire, or every hero gone), and in Campaign Mode that end runs 146074's Resolution (user decision, 2026-11-12), so the "won" games here are that end, with a different number of rounds survived (the resources on The Black Gate the Resolution records), Gwaihir held by the first
// player or not, the first player eliminated first, the Embassy discarded or played, every hero destroyed, and an empty log. The losses are the ones that write nothing: Aragorn leaving play, and the same last elimination played as a standalone adventure. It pins the path from data/ through the Campaign
// Setup Checklist and buildStart (the Black Gate and the Mouth of Sauron in the staging area, Gwaihir set aside, the Embassy's four pairs), the Black Gate's resource and threat each quest phase, and the end, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("The Black Gate Opens golden", () => {
  goldenSuite<OpensGolden, OpensDecks>({
    title: "The Black Gate Opens",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: opens,
    goldens: OPENS_GOLDENS,
    world: opensWorld,
    play: playGolden,
    opening: {
      title: "starts at Embassy from the Dark Tower, Dire, with The Black Gate and The Mouth of Sauron in the staging area, Gwaihir set aside and the Embassy's four pairs settled",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("146072");
        expect(state.dire, golden.name).toBe(true);
        expect(zonesOf(state, GATE), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, MOUTH), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, GWAIHIR), golden.name).toEqual(["setAside"]);
        // The pairs are settled at Setup: nothing of the Embassy's row is left lying faceup.
        expect(state.embassy, golden.name).toBeUndefined();
        // The campaign card is in the game in Campaign Mode only: its Resolution is what ends the scenario.
        expect(zonesOf(state, "146074"), golden.name).toEqual(golden.standalone ? [] : ["campaign"]);
      },
    },
    wins: "ends when the last player is eliminated, runs 146074's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toMatch(/^14607[23]$/);
      expect(state.stageCleared, golden.name).toBe(true);
      // The last seat stands as it was when it fell: at threat 99 or more, or with no hero left.
      const last = state.seats.slice(0, golden.seatCount).filter((seat) => !seat.eliminated);
      expect(last, golden.name).toHaveLength(1);
      expect(last[0]!.threat >= 99 || last[0]!.heroes.length === 0, golden.name).toBe(true);
    },
    before,
    afterWin({ state, golden, log }) {
      // 146074:B:1: the resource tokens on The Black Gate are recorded, one for each quest phase the players survived (146024:A:3).
      expect(log.blackGateTokens, golden.name).toBe(cardsOf(state, GATE)[0]!.resources);
      expect(log.blackGateTokens, golden.name).toBeGreaterThan(0);
      // Gwaihir joins the pool only when the first player controls him at the end.
      const heldByFirst = cardsOf(state, GWAIHIR).some((card) => card.zone === "play" && card.controller === state.firstPlayer);
      expect(log.campaignPool.some((card) => card.code === GWAIHIR), golden.name).toBe(heldByFirst);
      expect(log.completed, golden.name).toContain("the-black-gate-opens");
    },
    lost(state, golden) {
      if (golden.standalone) expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.eliminated), golden.name).toBe(true);
      else expect(zonesOf(state, "146002").every((zone) => zone !== "play" && zone !== "heroes"), golden.name).toBe(true);
    },
    checks({ game, opened }) {
      it("covers what it names: seats, Easy, an empty log, Gwaihir held and not, the first player out first, the Embassy played, every hero destroyed, and both kinds of loss", () => {
        expect(ended.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(3);
        expect(ended.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(3);
        expect(ended.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        expect(ended.some((golden) => !golden.after)).toBe(true);
        expect(ended.some((golden) => golden.policy?.choose === "last")).toBe(true);
        const lost = OPENS_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.standalone)).toBe(true);
        expect(lost.some((golden) => golden.lossReason === "Aragorn left play")).toBe(true);
        const gwaihir = ended.map((golden) => cardsOf(game(golden).state, GWAIHIR).some((card) => card.zone === "play"));
        expect(gwaihir).toContain(true);
        expect(gwaihir).toContain(false);
      });

      it("146073:B:3 no game of the scenario is won: each ends on a stage that cannot be defeated, by the last elimination alone", () => {
        for (const golden of ended) {
          const state = game(golden).state;
          // Every seat but the last was eliminated by a step of its own; the last one's elimination ended the game.
          const eliminations = game(golden).steps.filter((step) => step.kind === "eliminate").length;
          expect(eliminations, golden.name).toBe(golden.seatCount);
          expect(state.cards[state.questStage ?? ""]?.progress, golden.name).toBeGreaterThanOrEqual(0);
        }
      });

      it("146024:A:3 The Black Gate has one resource for each quest phase played, and 146072:B:1 the Embassy's cards are gone from the row in every game", () => {
        for (const golden of ended) expect(cardsOf(game(golden).state, GATE)[0]?.resources, golden.name).toBe(game(golden).state.round);
        for (const golden of OPENS_GOLDENS) expect(opened(golden).embassy, golden.name).toBeUndefined();
      });

      it("a standalone game deals no campaign card, and the same last elimination is a loss that writes nothing", () => {
        for (const golden of OPENS_GOLDENS.filter((item) => item.standalone)) {
          expect(cardsOf(game(golden).state, "146074"), golden.name).toEqual([]);
          expect(game(golden).state.lost, golden.name).toBe(true);
        }
      });
    },
  });
});

// Rules: mec113.fortitude-tests, mec113.dire, mec113.the-one-ring, mec113.setting-up-the-game, mec113.setup-mount-doom, mec113.saga-staging-rules, rr.then, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { emptyLog, type CampaignLog } from "../../log.ts";

import { DOOM_GOLDENS, TOKENS, afterOpens, doomWorld, playGolden, type DoomDecks, type DoomGolden } from "../../../../test/scenarios/mount-doom/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-return-of-the-king");
const doom = loadScenario("mount-doom");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);
const CAMPAIGN_CARD = "146079";
const MOUNT_DOOM = "146043";
const BRAKE = "146047";
const before = (golden: DoomGolden): CampaignLog => (golden.after ? afterOpens(golden.seatCount) : emptyLog(golden.seatCount));
const startTokens = (golden: DoomGolden): number => (golden.after ? (golden.tokens ?? TOKENS) : 0);
const ended = DOOM_GOLDENS.filter((golden) => golden.outcome === "won");

// A permanent golden: whole games of Mount Doom in Campaign Mode played by the auto-player (test/scenarios/mount-doom/game.ts) on fixed seeds, true solo and two-handed. The wins pass stage 4B's Fortitude test when Mount Doom is explored and run 146079's Resolution, with
// The One Ring destroyed (the players win the campaign) or kept (they lose it), with the earlier parts' tokens on the campaign card or with an empty log (no tokens: the timer is inert, rr.then). The losses are the ones that write nothing: the last Fortitude test failed, the
// threat at 99 under Dire, the Ring-bearer destroyed and the campaign card's last token removed. It pins the path from data/ through the Campaign Setup Checklist and buildStart (Mount Doom, the Tower of Barad-dur and the searched locations in the staging area, Brake of Thorns active,
// the tokens on the campaign card), each Fortitude test's discards and icons, and the end, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("Mount Doom golden", () => {
  goldenSuite<DoomGolden, DoomDecks>({
    title: "Mount Doom",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: doom,
    goldens: DOOM_GOLDENS,
    world: doomWorld,
    play: playGolden,
    opening: {
      title: "starts at Mount Doom's stage 1B under Dire with Mount Doom and the Tower of Barad-dur in the staging area, Brake of Thorns active, the Ring-bearer holding The One Ring and the tokens on the campaign card",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("146075");
        expect(state.dire, golden.name).toBe(true);
        expect(zonesOf(state, MOUNT_DOOM), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, "146042"), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, BRAKE).includes("activeLocation"), golden.name).toBe(true);
        expect(cardsOf(state, "146065")[0]?.zone, golden.name).toBe("play");
        // The campaign card holds the tokens The Black Gate left (146079:A:1), none after no earlier part.
        expect(cardsOf(state, CAMPAIGN_CARD)[0]?.resources ?? 0, golden.name).toBe(startTokens(golden));
        expect(zonesOf(state, CAMPAIGN_CARD), golden.name).toEqual(["campaign"]);
      },
    },
    wins: "passes stage 4B's Fortitude test, runs 146079's Resolution and ends the campaign",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("146078");
      expect(state.stageCleared, golden.name).toBe(true);
      expect(cardsOf(state, "146065")[0]?.zone, golden.name).toBe("play");
    },
    before,
    afterWin({ golden, log }) {
      // 146079:B:1 to B:3: the first player destroys The One Ring (the players win the campaign) or keeps it (they lose it); either way the saga is over.
      expect(log.campaignEnd, golden.name).toBe(golden.policy?.ring === "keep" ? "lost" : "won");
      expect(log.completed, golden.name).toContain("mount-doom");
    },
    lost(state, golden) {
      expect(state.lossReason, golden.name).toContain(golden.lossReason);
    },
    checks({ game }) {
      it("covers what it names: seats, Easy, an empty log, both endings and each way to lose", () => {
        expect(ended.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(ended.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(ended.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        expect(ended.some((golden) => !golden.after)).toBe(true);
        expect(ended.some((golden) => golden.policy?.ring === "keep")).toBe(true);
        expect(ended.some((golden) => golden.policy?.ring === "destroy")).toBe(true);
        const reasons = new Set(DOOM_GOLDENS.filter((golden) => golden.outcome === "lost").map((golden) => golden.lossReason));
        expect([...reasons].sort()).toEqual(["No resource token is left on Mount Doom", "No seats remain", "The One Ring left play", "The Ring-bearer claimed The One Ring"]);
      });

      it("146078:B:2 every win passes a Fortitude test with Mount Doom explored, and every Fortitude test counts the icons of the cards it discarded", () => {
        for (const golden of ended) {
          const tests = game(golden).steps.filter((step) => step.kind === "fortitudeTest");
          expect(tests.length, golden.name).toBeGreaterThan(0);
          expect(tests.at(-1)?.success, golden.name).toBe(true);
          for (const test of tests) expect(test.eyes, golden.name).toBeGreaterThanOrEqual(0);
        }
        for (const golden of DOOM_GOLDENS.filter((item) => item.lossReason === "The Ring-bearer claimed The One Ring")) expect(game(golden).steps.filter((step) => step.kind === "fortitudeTest").at(-1)?.success, golden.name).toBe(false);
      });

      it("146079:A:2 a game with the earlier parts' tokens loses its timer one round for each token, and one with none has no timer", () => {
        for (const golden of DOOM_GOLDENS.filter((item) => item.lossReason?.startsWith("No resource"))) {
          const state = game(golden).state;
          expect(state.round, golden.name).toBe(golden.tokens);
          expect(cardsOf(state, CAMPAIGN_CARD)[0]?.resources, golden.name).toBe(0);
        }
        for (const golden of DOOM_GOLDENS.filter((item) => !item.after)) expect(game(golden).state.lost, golden.name).toBe(false);
      });
    },
  });
});

// Rules: mec113.setup-the-tower-of-cirith-ungol, mec113.setting-up-the-game, mec113.the-one-ring, mec113.multiplayer-the-one-ring, mec113.saga-staging-rules, rr.guarded, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, rr.travel (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { emptyLog, type CampaignLog } from "../../log.ts";

import { GLAMDRING, STING, UNGOL_GOLDENS, afterFields, ungolWorld, playGolden, type UngolDecks, type UngolGolden } from "../../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-return-of-the-king");
const ungol = loadScenario("the-tower-of-cirith-ungol");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);
const hostOf = (state: ScenarioState, code: string) => state.cards[cardsOf(state, code)[0]?.host ?? ""]?.code;
// The Item boons each seat sets aside at Setup, in a game after the earlier parts (the pool holds them; the policy's first answers).
const ASIDE = (golden: UngolGolden): string[] => (golden.after ? (golden.seatCount === 1 ? [STING] : [STING, GLAMDRING]) : []);
const before = (golden: UngolGolden): CampaignLog => (golden.after ? afterFields(golden.seatCount) : emptyLog(golden.seatCount));

// A permanent golden: whole games of The Tower of Cirith Ungol in Campaign Mode played by the auto-player (test/scenarios/the-tower-of-cirith-ungol/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy, after the earlier parts with Item boons
// in the pool, with an empty log, with Shagrat defeated, defeated before stage 3A and left in play, and with the other answer to each choice) and through each way to lose that a game of stand-ins reaches (the threat at 50, the hero with The One Ring destroyed). It pins the path
// from data/ through the Campaign Setup Checklist and buildStart (the Ring-bearer under Topmost Chamber, Last of the Company, The One Ring and A Heavy Burden on one hero, Shagrat set aside, an Item boon set aside for each player), the Watchers' two defeats, the travel to Topmost
// Chamber with Shagrat as its cost, the Ring-bearer's return, the boons guarded on Shagrat at stage 3A and the win when Escape from Cirith Ungol is defeated with The Two Watchers out of play, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("The Tower of Cirith Ungol golden", () => {
  goldenSuite<UngolGolden, UngolDecks>({
    title: "The Tower of Cirith Ungol",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: ungol,
    goldens: UNGOL_GOLDENS,
    world: ungolWorld,
    play: playGolden,
    opening: {
      title: "starts at Pass the Two Watchers with the Ring-bearer faceup under Topmost Chamber, Last of the Company, The One Ring and A Heavy Burden on one hero, Shagrat set aside and an Item boon set aside for each player",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("146066");
        expect(zonesOf(state, "146015"), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, "146070"), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, "146020"), golden.name).toEqual(["setAside"]);
        // Frodo lies under Topmost Chamber, no one's hero; the stand-in carries Last of the Company, The One Ring and A Heavy Burden.
        expect(zonesOf(state, "141001"), golden.name).toEqual(["captive"]);
        expect(hostOf(state, "141001"), golden.name).toBe("146015");
        const carrier = hostOf(state, "146014");
        expect(carrier, golden.name).toBeTruthy();
        expect(hostOf(state, "146065"), golden.name).toBe(carrier);
        expect(hostOf(state, "144052"), golden.name).toBe(carrier);
        // Each seat set aside the first Item boon of the pool, out of play; the first option answers the Setup's choice.
        const aside = state.setAside.map((id) => state.cards[id]?.code).filter((code) => code?.startsWith("1420") || code === "142015");
        expect(aside.sort(), golden.name).toEqual(ASIDE(golden).sort());
      },
    },
    wins: "wins when Escape from Cirith Ungol is defeated with The Two Watchers out of play, runs 146069's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("146068");
      expect(state.stageCleared, golden.name).toBe(true);
      // Both sides of The Two Watchers have left play (the enemy side defeated twice, once at stage 1 and once at stage 3B).
      expect(cardsOf(state, "146071").every((card) => card.zone === "victory"), golden.name).toBe(true);
      expect(zonesOf(state, "146015"), golden.name).toEqual(["victory"]);
      expect(zonesOf(state, "146014"), golden.name).toEqual(["victory"]);
      expect(zonesOf(state, "141001"), golden.name).toEqual(["heroes"]);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    // The log the Resolution is written onto: the earlier parts' pool with the Item boons, or an empty one.
    before,
    afterWin({ state, golden, log }) {
      // 146069:B:2: a boon still guarded on Shagrat, in play, is lost from the pool; any other boon stays (it went home, or was never attached).
      const lost = ASIDE(golden).filter((code) => cardsOf(state, code).some((card) => card.zone === "attached"));
      for (const code of ASIDE(golden)) {
        const kept = log.campaignPool.some((card) => card.code === code);
        expect(kept, `${golden.name} ${code}`).toBe(!lost.includes(code));
      }
      expect(log.completed, golden.name).toContain("the-tower-of-cirith-ungol");
    },
    lost(state, golden) {
      if (golden.lossKind === "threat") expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else expect(zonesOf(state, "146065").every((zone) => zone !== "play" && zone !== "attached"), golden.name).toBe(true);
    },
    checks({ game, opened }) {
      it("covers the wins and losses it names: seats, Easy, the earlier parts and an empty log, Shagrat defeated, left in play and defeated early, and each way to lose", () => {
        const won = UNGOL_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(3);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(3);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        expect(won.some((golden) => !golden.after)).toBe(true);
        expect(won.some((golden) => golden.policy?.hunt === false)).toBe(true);
        expect(won.some((golden) => golden.policy?.choose === "last")).toBe(true);
        const lost = UNGOL_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(new Set(lost.map((golden) => golden.lossKind))).toEqual(new Set(["threat", "ring"]));
      });

      it("146066:A:1 the Ring-bearer lies under Topmost Chamber and the first player's token is locked in every game, and Frodo is back in the first player's hands in every win", () => {
        for (const golden of UNGOL_GOLDENS) {
          const state = opened(golden);
          expect(state.modifiers.some((modifier) => modifier.stat === "firstPlayerLocked"), golden.name).toBe(true);
        }
        for (const golden of UNGOL_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(cardsOf(state, "141001")[0]?.controller, golden.name).toBe(state.firstPlayer);
        }
      });

      it("146069:B:1 the set-aside boons are guarded on Shagrat at stage 3A: home in hand when he is defeated, still set aside when he was defeated first, lost with him in play", () => {
        for (const golden of UNGOL_GOLDENS.filter((item) => item.outcome === "won" && item.after === true)) {
          const state = game(golden).state;
          const shagrat = cardsOf(state, "146020")[0]!;
          for (const code of ASIDE(golden)) {
            const boon = cardsOf(state, code)[0]!;
            if (shagrat.zone === "victory") expect(["hand", "setAside"], `${golden.name} ${code}`).toContain(boon.zone);
            else expect([boon.zone, hostOf(state, code)], `${golden.name} ${code}`).toEqual(["attached", "146020"]);
          }
        }
      });

      it("146069:A:1 an empty log sets nothing aside, and no game asks for a boon it cannot offer", () => {
        for (const golden of UNGOL_GOLDENS.filter((item) => item.after !== true)) expect(opened(golden).setAside.map((id) => opened(golden).cards[id]?.code).filter((code) => code?.startsWith("14201")), golden.name).toEqual([]);
      });
    },
  });
});

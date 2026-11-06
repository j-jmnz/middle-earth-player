// Rules: emce.setup-fire-in-the-night, emce.side-quests, emce.side-quests-in-play, emce.boon-allies, emce.treasure, emce.campaign-log, rr.attacks-outside-the-combat-phase, rr.first-player, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { NIGHT_GOLDENS, logBeforeGolden, nightChoices, nightPlan, nightWorld, playGolden, type NightDecks, type NightGolden } from "../../../../test/scenarios/fire-in-the-night/game.ts";
import { CODES, campaign, night } from "../../../../test/scenarios/fire-in-the-night/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of Fire in the Night in Campaign Mode played by the auto-player (test/scenarios/fire-in-the-night/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, from a blank log and after Journey Up the Anduin's, Lost in
// Mirkwood's, The King's Quest's, The Withered Heath's and Roam Across Rhovanion's real Resolutions, with the allies and Misplaced Trust or Urdug's Cunning in the pool or Turayn's, Melanwar's and Isolde's lines written; a side quest made the current quest every round or every other
// round; the attack on Hrogar's Hill defended or not; the enemies engaged or left in the staging area; Beldis healing; a Response of a defeated side quest used or passed; Beldis in the pool or the line; the treasure of three at 5 or more progress on the Hill, or none; a card of the pool
// removed or none) and through each way to lose (heroes too small to quest, heroes too brittle to survive, Hrogar's Hill holding 50 damage, heroes destroyed after four side quests). It pins the path from data/ through the Campaign Setup Checklist and buildStart, the side quest, Dagnir and
// campaign card records, the Resolution's Beldis, treasure and pool effects and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const wonGoldens = () => NIGHT_GOLDENS.filter((golden) => golden.outcome === "won");
const dagnirOf = (state: ScenarioState) => Object.values(state.cards).find((card) => card.code === CODES.dagnir)!;
const victorySideQuests = (state: ScenarioState, types: ReadonlyMap<string, { type: string }>) => Object.values(state.cards).filter((card) => card.zone === "victory" && types.get(card.code)?.type === "encounter-side-quest");
const HILL_QUEST_POINTS = 50;

describe("Fire in the Night golden", () => {
  goldenSuite<NightGolden, NightDecks>({
    title: "Fire in the Night",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: night,
    goldens: NIGHT_GOLDENS,
    world: nightWorld,
    play: playGolden,
    before: (golden) => logBeforeGolden(golden),
    opening: {
      title: "starts with Beldis under the first player, Dagnir in the staging area, the eight side quests in a deck of their own, Hrogar's Hill as the quest, the campaign card on the table, and 3 locations and 3 enemies removed for Turayn's and Isolde's lines",
      check(state, golden, world) {
        const zoneOf = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe(CODES.stage1);
        expect(zoneOf(CODES.beldis), golden.name).toEqual(["play"]);
        expect(Object.values(state.cards).find((card) => card.code === CODES.beldis)?.controller, golden.name).toBe(state.firstPlayer);
        expect(zoneOf(CODES.dagnir), golden.name).toEqual(["staging"]);
        expect(zoneOf(CODES.campaignCard), golden.name).toEqual(["campaign"]);
        expect(state.piles?.sideQuestDeck, golden.name).toHaveLength(8);
        expect(state.questDeck, golden.name).toEqual([]);
        // The cards the pool's lines remove (12187:A:2): 3 locations for Turayn's oath, 3 enemies for Isolde's line.
        const log = logBeforeGolden(golden);
        const removed = nightPlan(golden.seatCount, log, nightChoices(golden), golden.difficulty).removedFromEncounter;
        expect(removed, golden.name).toHaveLength(((log.allyLines ?? []).includes("turayn") ? 3 : 0) + ((log.allyLines ?? []).includes("isolde") ? 3 : 0));
        for (const code of removed) expect(world.cards.get(code)?.isUnique, golden.name).not.toBe(true);
      },
    },
    wins: "wins by destroying Dagnir after three or more side quests are in the victory display, runs 12187's Resolution and unlocks the next part",
    won(state, golden, world) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage1);
      // Dagnir is destroyed (he has no hit points left, and the victory display takes him), and he could only be attacked once 3 side quests were in the victory display.
      const dagnir = dagnirOf(state);
      expect(dagnir.zone, golden.name).toBe("victory");
      expect(dagnir.damage, golden.name).toBeGreaterThanOrEqual(world.cards.get(CODES.dagnir)?.health ?? 0);
      expect(victorySideQuests(state, world.cards).length, golden.name).toBeGreaterThanOrEqual(3);
      // Hrogar's Hill holds less damage than it has quest points.
      expect(state.cards[state.questStage ?? ""]?.damage ?? 0, golden.name).toBeLessThan(HILL_QUEST_POINTS);
      const log = state.resolutionLog;
      // 12187:B:1: Beldis joins the pool for a player, or the log takes his line.
      if (golden.policy?.beldis === "line") {
        expect(log.allyLines, golden.name).toEqual(["beldis"]);
        expect(log.earned.map((item) => item.code), golden.name).not.toContain(CODES.beldis);
      } else {
        expect(log.allyLines, golden.name).toBeUndefined();
        expect(log.earned.filter((item) => item.code === CODES.beldis), golden.name).toHaveLength(1);
      }
      // 12187:B:2: with at least 5 progress on Hrogar's Hill the first player chose 1 treasure of 3; with less none was offered.
      const progress = state.cards[state.questStage ?? ""]?.progress ?? 0;
      if (progress >= 5) expect(log.treasures, golden.name).toHaveLength(1);
      else expect(log.treasures, golden.name).toBeUndefined();
      // 12187:B:4: each player in turn (the first player first) removed a card from the pool, or nobody was asked when the pool held none.
      const answers = log.poolAnswers ?? [];
      const living = state.seats.flatMap((seat, index) => (seat.eliminated ? [] : [index]));
      const pooled = golden.after && golden.policy?.remove != null && golden.policy.remove !== "skip";
      expect(answers.map((item) => item.seat).sort(), golden.name).toEqual(pooled ? living : []);
      if (pooled) expect(answers[0]?.seat, golden.name).toBe(state.firstPlayer);
    },
    lost(state, golden) {
      expect(state.stageCleared, golden.name).toBe(false);
      // Dagnir lives on in a lost game, and the victory display never held enough side quests to destroy him unless the heroes fell first.
      if (golden.lossReason === "Hrogar's Hill holds") expect(state.cards[state.questStage ?? ""]?.damage ?? 0, golden.name).toBeGreaterThanOrEqual(HILL_QUEST_POINTS);
      expect(dagnirOf(state).zone, golden.name).not.toBe("victory");
    },
    checks({ game, world }) {
      it("the first attack on Hrogar's Hill (19083:B:1) is defended or left undefended as the policy says, and is Dagnir's", () => {
        for (const golden of NIGHT_GOLDENS.filter((item) => item.decks === "strong")) {
          const { steps, state } = game(golden);
          const attack = steps.findIndex((step) => step.kind === "attack" && step.side === "enemy");
          expect(attack, golden.name).toBeGreaterThanOrEqual(0);
          expect(state.cards[(steps[attack] as { enemyId: string }).enemyId]?.code, golden.name).toBe(CODES.dagnir);
          const strike = steps.slice(attack).find((step) => step.kind === "strike");
          expect(strike?.kind === "strike" && strike.undefended, golden.name).toBe(golden.policy?.defend !== "hill");
        }
      });

      it("makes a side quest the current quest every round, every other round or never, and the side quests defeated go to the victory display", () => {
        const defeated = (golden: NightGolden) => victorySideQuests(game(golden).state, world(golden).cards).length;
        // Never: Hrogar's Hill takes the progress and no side quest is defeated.
        for (const golden of NIGHT_GOLDENS.filter((item) => item.policy?.current === "main")) expect(defeated(golden), golden.name).toBe(0);
        // Every round: more side quests are defeated than with every other round on the same seeds.
        for (const golden of wonGoldens().filter((item) => (item.policy?.current ?? "side") === "side")) expect(defeated(golden), golden.name).toBeGreaterThanOrEqual(5);
        for (const golden of wonGoldens().filter((item) => item.policy?.current === "alternate")) expect(defeated(golden), golden.name).toBeGreaterThanOrEqual(3);
        expect(wonGoldens().some((golden) => (golden.policy?.current ?? "side") === "side")).toBe(true);
        expect(wonGoldens().some((golden) => golden.policy?.current === "alternate")).toBe(true);
      });

      it("covers the wins and losses it names: seats, Easy, the earlier parts, every pool, the treasure and its absence, Beldis in the pool and as the line", () => {
        expect(wonGoldens().filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(7);
        expect(wonGoldens().filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(6);
        expect(wonGoldens().filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(4);
        expect(wonGoldens().filter((golden) => golden.after).length).toBeGreaterThanOrEqual(6);
        for (const variant of ["pool", "cunning", "oath", "oathline"] as const) expect(wonGoldens().some((golden) => golden.after && (golden.variant ?? "pool") === variant), variant).toBe(true);
        expect(NIGHT_GOLDENS.filter((golden) => golden.outcome === "lost").length).toBeGreaterThanOrEqual(8);
        const treasures = wonGoldens().map((golden) => game(golden).state.resolutionLog.treasures?.length ?? 0);
        expect(treasures.some((count) => count === 1)).toBe(true);
        expect(treasures.some((count) => count === 0)).toBe(true);
        const beldis = wonGoldens().map((golden) => game(golden).state.resolutionLog.allyLines?.includes("beldis") === true);
        expect(beldis.some(Boolean) && beldis.some((line) => !line)).toBe(true);
        // A Beldis for the second player, and a pool card or an encounter copy removed by each player.
        expect(wonGoldens().some((golden) => game(golden).state.resolutionLog.earned.some((item) => item.code === CODES.beldis && item.seat === 1))).toBe(true);
        const answers = wonGoldens().flatMap((golden) => game(golden).state.resolutionLog.poolAnswers ?? []);
        expect(answers.some((item) => item.option.startsWith("p:"))).toBe(true);
        expect(answers.some((item) => item.option.startsWith("e:"))).toBe(true);
      });

      it("loses on Hrogar's Hill, on threat and with every hero destroyed", () => {
        const reasons = new Set(NIGHT_GOLDENS.filter((golden) => golden.outcome === "lost").map((golden) => golden.lossReason));
        expect([...reasons].sort()).toEqual(["Hrogar's Hill holds", "No seats remain"]);
        expect(NIGHT_GOLDENS.some((golden) => golden.outcome === "lost" && game(golden).state.lossReason?.startsWith("Hrogar's Hill holds 50")), "exactly 50").toBe(true);
      });
    },
  });
});

// Rules: emce.campaign-log, emce.boon-allies, emce.treasure, emce.campaign-pool-encounter, rr.engaged, rr.first-player, rr.winning-the-game, rr.player-elimination, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { livingSeats, type ScenarioState } from "../../../rules/core/state.ts";
import { WILDERLAND_GOLDENS, logBeforeGolden, playGolden, wilderlandChoices, wilderlandPlan, wilderlandWorld, type WilderlandDecks, type WilderlandGolden } from "../../../../test/scenarios/the-fate-of-wilderland/game.ts";
import { CODES, STAGES, campaign, wilderland } from "../../../../test/scenarios/the-fate-of-wilderland/scene.ts";
import { nextStep } from "../../path.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of The Fate of Wilderland in Campaign Mode played by the auto-player (test/scenarios/the-fate-of-wilderland/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, from a blank log and after
// Journey Up the Anduin's through Mount Gundabad's real Resolutions, with the allies and Misplaced Trust or Urdug's Cunning in the pool, the treasures logged and Turayn's, Melanwar's, Isolde's and Beldis's lines written; the Choose windows answered each way, the attacks
// made one at a time or together; every win destroys Urdug once The Heroes' Defense holds 5 resources for each player) and through each way to lose (The Goblins' Assault holding 8 plus 8 progress for each player, heroes too small to quest, heroes too brittle to
// survive, every seat eliminated). It pins the path from data/ through the Campaign Setup Checklist and buildStart, the Setup of the campaign card (a boon or treasure searched into the hand, Turayn's and Beldis's removals), the three stages and the reducer, so a change
// that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const wonGoldens = () => WILDERLAND_GOLDENS.filter((golden) => golden.outcome === "won");
const lostGoldens = () => WILDERLAND_GOLDENS.filter((golden) => golden.outcome === "lost");
const zoneOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
const used = (intents: readonly { type: string }[], effectId: string) => intents.some((intent) => intent.type === "Trigger" && (intent as { effectId?: string }).effectId === effectId);
/** The Heroes' Defense's resources in a state. */
const resourcesOnDefense = (state: ScenarioState) => Object.values(state.cards).find((card) => card.code === CODES.theHeroesDefense)?.resources ?? 0;
const progressOnAssault = (state: ScenarioState) => Object.values(state.cards).find((card) => card.code === CODES.theGoblinsAssault)?.progress ?? 0;

describe("The Fate of Wilderland golden", () => {
  goldenSuite<WilderlandGolden, WilderlandDecks>({
    title: "The Fate of Wilderland",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: wilderland,
    goldens: WILDERLAND_GOLDENS,
    world: wilderlandWorld,
    play: playGolden,
    before: (golden) => logBeforeGolden(golden),
    opening: {
      title: "starts with the campaign card on the table, The Goblins' Assault, The Heroes' Defense and Urdug in the staging area, one enemy for each player beside them, stage 1 current, and the cards Turayn's and Beldis's lines remove",
      check(state, golden, world) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe(CODES.stage1);
        expect(state.questDeck.map((id) => state.cards[id]?.code), golden.name).toEqual([CODES.stage2, CODES.stage3]);
        expect(zoneOf(state, CODES.campaignCard), golden.name).toEqual(["campaign"]);
        for (const code of [CODES.theGoblinsAssault, CODES.theHeroesDefense, CODES.urdug]) expect(zoneOf(state, code), `${golden.name} ${code}`).toEqual(["staging"]);
        expect(progressOnAssault(state), golden.name).toBe(0);
        expect(resourcesOnDefense(state), golden.name).toBe(0);
        // 19168:A:1: the encounter deck is shuffled and cards discarded from its top until X enemies, X the number of players, are discarded; they are added to the staging area (Urdug is one of the enemies there).
        const enemies = Object.values(state.cards).filter((card) => card.zone === "staging" && world.cards.get(card.code)?.type === "enemy" && card.code !== CODES.urdug);
        expect(enemies.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
        // 12195:A:2: Turayn's line removes 3 non-unique enemies, Beldis's 3 treacheries, from the encounter deck; never a unique card.
        const lines = logBeforeGolden(golden).allyLines ?? [];
        const plan = wilderlandPlan(golden.seatCount, logBeforeGolden(golden), wilderlandChoices(golden), golden.difficulty);
        expect(plan.removedFromEncounter, golden.name).toHaveLength((lines.includes("turayn") ? 3 : 0) + (lines.includes("beldis") ? 3 : 0));
        for (const code of plan.removedFromEncounter) expect(world.cards.get(code)?.isUnique, golden.name).not.toBe(true);
      },
    },
    wins: "wins by destroying Urdug once The Heroes' Defense holds 5 resources for each player, runs 12195's Resolution and completes the campaign",
    won(state, golden) {
      // Urdug is destroyed (19157:A:3) in the stage the game ended on, and was engaged with each player: The Heroes' Defense held 5 resources for each player still in the game when he fell (a seat eliminated by its threat is no longer a player).
      expect(zoneOf(state, CODES.urdug), golden.name).toEqual(["victory"]);
      expect(resourcesOnDefense(state), golden.name).toBeGreaterThanOrEqual(5 * livingSeats(state).length);
      expect(STAGES, golden.name).toContain(state.cards[state.questStage ?? ""]?.code);
      // 12195:B:1: the players win the campaign; the Resolution writes nothing.
      expect(state.resolutionLog.treasures, golden.name).toBeUndefined();
      expect(state.resolutionLog.encounterPool, golden.name).toBeUndefined();
    },
    lost(state, golden) {
      // A loss leaves the log alone.
      expect(state.resolutionLog.treasures, golden.name).toBeUndefined();
      expect(state.resolutionLog.encounterPool, golden.name).toBeUndefined();
      expect(zoneOf(state, CODES.urdug), golden.name).not.toContain("victory");
    },
    afterWin({ golden, log, path }) {
      // The last part: the win completes it and the path has nothing after it (nextStep is finished).
      expect(log.completed.at(-1), golden.name).toBe(wilderland.id);
      expect(path.every((node) => node.status === "completed"), golden.name).toBe(true);
      expect(nextStep(path, null), golden.name).toEqual({ kind: "finished" });
    },
    checks({ game, world, opened }) {
      it("covers the wins and losses it names: seats, Easy, the earlier parts, every pool and line, every way to lose", () => {
        expect(wonGoldens().filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(6);
        expect(wonGoldens().filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(6);
        expect(wonGoldens().filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(4);
        expect(wonGoldens().filter((golden) => golden.after).length).toBeGreaterThanOrEqual(4);
        for (const variant of ["pool", "cunning", "oath", "oathline", "beldis"] as const) expect(WILDERLAND_GOLDENS.some((golden) => golden.after && golden.variant === variant), variant).toBe(true);
        expect(lostGoldens().length).toBeGreaterThanOrEqual(10);
        expect(lostGoldens().filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(5);
        expect(lostGoldens().filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(5);
      });

      it("hands the log of the earlier parts to the game: the treasures, the pool and the lines reach the state", () => {
        for (const golden of WILDERLAND_GOLDENS.filter((item) => item.after)) {
          const before = logBeforeGolden(golden);
          expect(before.completed, golden.name).toEqual(campaign.scenarios.slice(0, 8));
          expect(opened(golden).campaignFacts?.treasures, golden.name).toEqual(before.treasures);
          expect(opened(golden).campaignFacts?.encounterPool ?? {}, golden.name).toEqual(before.encounterPool ?? {});
        }
        expect(WILDERLAND_GOLDENS.some((golden) => golden.after && (logBeforeGolden(golden).treasures.length ?? 0) > 0)).toBe(true);
        expect(WILDERLAND_GOLDENS.some((golden) => golden.after && (logBeforeGolden(golden).allyLines ?? []).includes("beldis"))).toBe(true);
        expect(WILDERLAND_GOLDENS.some((golden) => golden.after && (logBeforeGolden(golden).allyLines ?? []).includes("turayn"))).toBe(true);
      });

      it("places resources on The Heroes' Defense with its Response in every win, and in some losses", () => {
        for (const golden of wonGoldens()) expect(used(game(golden).intents, "19156:response:1"), golden.name).toBe(true);
        expect(lostGoldens().some((golden) => used(game(golden).intents, "19156:response:1"))).toBe(true);
      });

      it("loses on The Goblins' Assault in games where the enemies come too fast, and with nobody engaged", () => {
        const assault = lostGoldens().filter((golden) => golden.lossReason === "The Goblins' Assault");
        expect(assault.length).toBeGreaterThanOrEqual(6);
        // The stage 3 loss: The Goblins' Assault holds 8 plus 8 progress for each player.
        for (const golden of assault) {
          expect(game(golden).state.cards[game(golden).state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage3);
          expect(progressOnAssault(game(golden).state), golden.name).toBeGreaterThanOrEqual(8 + 8 * golden.seatCount);
        }
        for (const golden of assault.filter((item) => item.policy?.engage === false)) expect(game(golden).intents.some((intent) => intent.type === "Engage"), golden.name).toBe(false);
      });

      it("loses on threat, with every hero destroyed, and with every seat eliminated", () => {
        const lost = lostGoldens();
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
        expect(lost.filter((golden) => golden.lossReason === "No seats remain").length).toBeGreaterThanOrEqual(5);
        for (const golden of lost) expect(game(golden).state.stageCleared, golden.name).toBe(false);
        // The weak heroes cannot quest: every seat is eliminated by its threat.
        for (const golden of lost.filter((item) => item.decks === "weak")) expect(game(golden).steps.filter((step) => step.kind === "eliminate"), golden.name).toHaveLength(golden.seatCount);
      });

      it("destroys Urdug only after he resolved an attack, on a stage after the first", () => {
        for (const golden of wonGoldens()) {
          const { state, steps } = game(golden);
          const urdug = Object.values(state.cards).find((card) => card.code === CODES.urdug)?.id;
          // 19155:A:1: Urdug takes no damage unless he has resolved an attack this phase: an attack of his comes before the hit that destroys him.
          const fell = steps.findIndex((step) => step.kind === "destroy" && step.targetId === urdug);
          expect(fell, golden.name).toBeGreaterThan(0);
          expect(steps.slice(0, fell).some((step) => step.kind === "attack" && step.side === "enemy" && step.enemyId === urdug), golden.name).toBe(true);
        }
        // The resources take rounds to gather: every win is on a stage after the first.
        for (const golden of wonGoldens()) expect([CODES.stage2, CODES.stage3], golden.name).toContain(game(golden).state.cards[game(golden).state.questStage ?? ""]?.code);
      });

      it("deals every card of the stand-in world: a treasure, a boon of the pool, none unknown", () => {
        for (const golden of WILDERLAND_GOLDENS.slice(0, 3)) for (const card of Object.values(game(golden).state.cards)) expect(world(golden).cards.has(card.code), `${golden.name} ${card.code}`).toBe(true);
      });
    },
  });
});

// Rules: emce.setup-roam-across-rhovanion, emce.campaign-pool-encounter, emce.boon-allies, emce.indestructible, rr.objective-cards, rr.guarded, rr.victory, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { startScenario } from "../../../rules/engine/reduce.ts";
import { RHOVANION_GOLDENS, logBeforeGolden, playGolden, rhovanionChoices, rhovanionPlan, rhovanionSetupChoices, rhovanionStart, rhovanionWorld, type RhovanionDecks, type RhovanionGolden } from "../../../../test/scenarios/roam-across-rhovanion/game.ts";
import { CODES, campaign, rhovanion } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of Roam Across Rhovanion in Campaign Mode played by the auto-player (test/scenarios/roam-across-rhovanion/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, from a blank log and after Journey Up the
// Anduin's, Lost in Mirkwood's, The King's Quest's and The Withered Heath's real Resolutions, the allies in the pool or Turayn's, Melanwar's and Isolde's lines written; the boon-ally search taken or skipped; the trust in Urdug put at every claim, twice or never; each of the six orders
// the three stages 2 can be played in, the guards found and the objectives claimed; stage 3 with Urdug and Tiny on their enemy sides, fought in the staging area until Urdug has no hit points left; Misplaced Trust or Urdug's Cunning for each player; a copy of a location of the
// staging area for the pool, the first or the last offered) and through each way to lose (heroes too small to quest, heroes too brittle to survive, the threat at a stage 2, Urdug's Gambit holding 5 progress). It pins the path from data/ through the Campaign Setup Checklist and
// buildStart, the stage, objective and Urdug records, the Resolution's pool and log-line effects and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const STAGE_TWOS: readonly string[] = [CODES.stage2, CODES.stage3, CODES.stage4];
const wonGoldens = () => RHOVANION_GOLDENS.filter((golden) => golden.outcome === "won");
const urdugOf = (state: { cards: Record<string, { code: string; resources: number; damage: number; zone: string }> }) => Object.values(state.cards).find((card) => card.code === CODES.urdugEnemy)!;

describe("Roam Across Rhovanion golden", () => {
  goldenSuite<RhovanionGolden, RhovanionDecks>({
    title: "Roam Across Rhovanion",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: rhovanion,
    goldens: RHOVANION_GOLDENS,
    world: rhovanionWorld,
    play: playGolden,
    before: (golden) => logBeforeGolden(golden),
    opening: {
      title: "starts with Urdug under the first player (one resource of trust on him), Tiny, Urdug's Horn and Durin's Key set aside, the other stages in the quest deck, the campaign card on the table, a location for each player in the staging area, and a boon ally in the hand when the search took one",
      check(state, golden, world) {
        const zoneOf = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe(CODES.stage1);
        expect(zoneOf(CODES.urdug), golden.name).toEqual(["play"]);
        expect(Object.values(state.cards).find((card) => card.code === CODES.urdug)?.controller, golden.name).toBe(0);
        for (const code of [CODES.tiny, CODES.urdugSHorn, CODES.durinSKey]) expect(zoneOf(code), `${golden.name} ${code}`).toEqual(["setAside"]);
        expect(state.questDeck.map((id) => state.cards[id]?.code).sort(), golden.name).toEqual([...STAGE_TWOS, CODES.stage5].sort());
        expect(zoneOf(CODES.campaignCard), golden.name).toEqual(["campaign"]);
        // The trust: the first answer of the Setup is "trust", so a resource is on Urdug, whichever the policy's later answers are.
        expect(Object.values(state.cards).find((card) => card.code === CODES.urdug)?.resources, golden.name).toBe(1);
        // A location for each player.
        // (and The Threat to Wilderland when the pool holds it: it enters the staging area at its Setup).
        const staged = state.staging.filter((id) => state.cards[id]?.code !== CODES.threatToWilderland);
        expect(staged, golden.name).toHaveLength(golden.seatCount);
        for (const id of staged) expect(world.cards.get(state.cards[id]?.code ?? "")?.type, golden.name).toBe("location");
        // The boon ally search (12184:A:2): the first player's hand holds the unique boon ally taken (it is not in their deck any more).
        const pooled = logBeforeGolden(golden).campaignPool.map((card) => card.code).filter((code) => ([CODES.turayn, CODES.melanwar, CODES.isolde] as string[]).includes(code));
        const taken = pooled.length > 0 && golden.ally !== "skip" ? rhovanionChoices(golden)[0] : undefined;
        if (taken) {
          expect(state.seats[0]?.hand.map((id) => state.cards[id]?.code), golden.name).toContain(taken);
          expect(state.seats[0]?.deck.map((id) => state.cards[id]?.code), golden.name).not.toContain(taken);
        }
      },
    },
    wins: "wins on Urdug's Gambit with Urdug's damage as great as his hit points, runs 12184's Resolution and unlocks the next part",
    won(state, golden, world) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage5);
      // The three stages 2 were each played and are gone; none waits in the quest deck.
      expect(state.questDeck, golden.name).toEqual([]);
      const urdug = urdugOf(state);
      expect(urdug.damage, golden.name).toBeGreaterThanOrEqual(world.cards.get(CODES.urdugEnemy)?.health ?? 0);
      // The three objectives were claimed at their stages and Tiny and Urdug flipped: neither objective side is left in play.
      expect(Object.values(state.cards).filter((card) => card.code === CODES.tiny || card.code === CODES.urdug), golden.name).toEqual([]);
      // 12184:B:3: with 3 or more resources on Urdug each player earns Misplaced Trust (after the starting hand), else Urdug's Cunning.
      const earned = state.resolutionLog.earned;
      const trusted = urdug.resources >= 3;
      const wanted = trusted ? CODES.misplacedTrust : CODES.urdugSCunning;
      expect(earned.map((item) => item.code), golden.name).toEqual(Array.from({ length: golden.seatCount }, () => wanted));
      expect(earned.map((item) => item.seat).sort(), golden.name).toEqual(Array.from({ length: golden.seatCount }, (_, seat) => seat));
      for (const item of earned) expect(item.afterHand === true, golden.name).toBe(trusted);
      // 12184:B:4: each player in turn (the first player first) chose a location of the staging area (a different title if able), and a copy of it joined the pool; with none left in the staging area nobody was asked.
      const answers = state.resolutionLog.poolAnswers ?? [];
      const staged = new Set(state.staging.flatMap((id) => (state.cards[id] && world.cards.get(state.cards[id].code)?.type === "location" && world.cards.get(state.cards[id].code)?.campaignKind !== "burden" ? [state.cards[id].code] : [])));
      // (A player eliminated before the win is not asked.)
      const living = state.seats.flatMap((seat, index) => (seat.eliminated ? [] : [index]));
      expect(answers.map((item) => item.seat).sort(), golden.name).toEqual(staged.size === 0 ? [] : living);
      expect(answers[0]?.seat ?? state.firstPlayer, golden.name).toBe(state.firstPlayer);
      for (const answer of answers) expect(staged.has(answer.option), golden.name).toBe(true);
      // A different title for each player when the staging area holds as many titles as there are players.
      if (staged.size >= living.length) expect(new Set(answers.map((item) => item.option)).size, golden.name).toBe(answers.length);
      const policy = golden.policy?.trust;
      if (policy === 0) expect(urdug.resources, golden.name).toBe(0);
      if (policy === 2) expect(urdug.resources, golden.name).toBe(2);
    },
    checks({ game, world }) {
      it("reaches all six orders of the three stages 2, each stage 2 once and then stage 3, solo and two-handed", () => {
        const orders = new Set<string>();
        for (const golden of wonGoldens()) {
          const { state, steps } = game(golden);
          const advanced = steps.flatMap((step) => (step.kind === "advance" ? [state.cards[step.cardId]?.code ?? ""] : []));
          expect(advanced.slice(0, 3).sort(), golden.name).toEqual([...STAGE_TWOS].sort());
          expect(advanced.slice(-1), golden.name).toEqual([CODES.stage5]);
          orders.add(advanced.slice(0, 3).join(">"));
          // The name of each golden tells the order the seed chose: Tiny (stage 19048), the Horn (19049), the Key (19050).
          const told = advanced.slice(0, 3).map((code) => (code === CODES.stage2 ? "Tiny" : code === CODES.stage3 ? "Horn" : "Key")).join(", ");
          expect(golden.name, golden.name).toContain(told);
        }
        expect(orders.size).toBe(6);
        expect(wonGoldens().filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(7);
        expect(wonGoldens().filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(5);
        expect(wonGoldens().filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(3);
        expect(wonGoldens().filter((golden) => golden.after).length).toBeGreaterThanOrEqual(6);
        expect(wonGoldens().filter((golden) => golden.variant != null && golden.variant !== "pool").length).toBeGreaterThanOrEqual(3);
        expect(RHOVANION_GOLDENS.filter((golden) => golden.outcome === "lost").length).toBeGreaterThanOrEqual(7);
      });

      it("earns both Misplaced Trust and Urdug's Cunning, takes the first and the last location, and searches for a boon ally or skips", () => {
        const states = wonGoldens().map((golden) => game(golden).state);
        const earned = states.flatMap((state) => state.resolutionLog.earned.map((item) => item.code));
        expect(earned).toContain(CODES.misplacedTrust);
        expect(earned).toContain(CODES.urdugSCunning);
        const answers = (golden: RhovanionGolden) => game(golden).state.resolutionLog.poolAnswers ?? [];
        // The last location offered, and the first: the golden that takes the last of two titles, then the last of the one left.
        expect(wonGoldens().filter((golden) => golden.policy?.location === "last").every((golden) => answers(golden).length >= 1)).toBe(true);
        expect(wonGoldens().filter((golden) => golden.policy?.location !== "last" && answers(golden).length > 0).length).toBeGreaterThanOrEqual(3);
        // Two copies of one title are one choice, and both players take it; and a game with no location left asks nobody.
        expect(wonGoldens().some((golden) => golden.seatCount === 2 && answers(golden).length === 2 && answers(golden)[0]?.option === answers(golden)[1]?.option)).toBe(true);
        expect(wonGoldens().some((golden) => golden.seatCount === 2 && answers(golden).length === 0)).toBe(true);
        expect(wonGoldens().some((golden) => golden.ally === "skip")).toBe(true);
        expect(wonGoldens().filter((golden) => golden.after && golden.ally !== "skip" && (golden.variant ?? "pool") === "pool").length).toBeGreaterThanOrEqual(2);
      });

      it("asks the first player about trust (12184:B:1) after each claim: Tiny, the Horn and the Key, and the trust puts the resources on Urdug", () => {
        for (const golden of wonGoldens()) {
          const { state, steps } = game(golden);
          const card = Object.values(state.cards).find((item) => item.code === CODES.campaignCard)!;
          const asked = steps.filter((step) => step.kind === "push" && step.frame === "forced" && step.cardId === card.id).length;
          expect(asked, golden.name).toBeGreaterThanOrEqual(3);
          expect(urdugOf(state).resources, golden.name).toBeLessThanOrEqual(1 + asked);
        }
      });

      it("removes 3 non-unique enemies other than Grey Mountain Giant with Melanwar's line, the first player naming each", () => {
        for (const golden of RHOVANION_GOLDENS.filter((item) => item.after && item.variant && item.variant !== "pool")) {
          const log = logBeforeGolden(golden);
          expect(log.allyLines, golden.name).toContain("melanwar");
          const plan = rhovanionPlan(golden.seatCount, log, rhovanionChoices(golden), golden.difficulty);
          const removed = plan.removedFromEncounter.map((code) => world(golden).cards.get(code));
          expect(removed, golden.name).toHaveLength(3);
          for (const card of removed) {
            expect(card?.type, golden.name).toBe("enemy");
            expect(card?.isUnique, golden.name).not.toBe(true);
            expect(card?.code, golden.name).not.toBe(CODES.greyMountainGiant);
          }
          const bare = { ...log, allyLines: (log.allyLines ?? []).filter((line) => line !== "melanwar") };
          const without = rhovanionStart(golden.seatCount, golden.seed, golden.difficulty, undefined, bare, undefined, rhovanionSetupChoices(golden.seatCount, bare, golden.difficulty, golden.ally));
          const enemies = (start: typeof without) => Object.values(startScenario(start, world(golden).ctx).cards).filter((card) => world(golden).cards.get(card.code)?.type === "enemy" && card.zone === "encounterDeck").length;
          expect(enemies(without) - enemies(game(golden).start), golden.name).toBe(3);
        }
      });
    },
  });
});

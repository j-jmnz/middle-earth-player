// Rules: emce.setup-roam-across-rhovanion, emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.setup (data/rules/entries.json).
// Roam Across Rhovanion in the Ered Mithrin campaign: it is the fifth part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. The four earlier parts' real Resolutions (Journey Up the Anduin's, Lost in Mirkwood's,
// The King's Quest's and The Withered Heath's golden wins, applied one after the other to a blank log) are what reaches it: Turayn, Melanwar and Isolde in a player's pool or their lines, the burdens and Abandoned Ruin, the encounter cards the parts pooled, the Accolade and Song
// boons, the treasures discovered, all through the Campaign Setup Checklist, whose boon-ally search and Melanwar-line enemy removal this part adds, and the first player's trust in Urdug, asked once the quest card's Setup has put Urdug under them. Winning this part runs its Resolution
// (Misplaced Trust or Urdug's Cunning for each player, a copy of a location of the staging area for the pool) and unlocks Fire in the Night (coming soon); a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { RHOVANION_GOLDENS, afterHeath, logBeforeGolden, playGolden, rawEarlier, rhovanionChoices, rhovanionLoadout, rhovanionPlan, rhovanionSetupChoices, rhovanionStart, rhovanionWorld } from "../../../../test/scenarios/roam-across-rhovanion/game.ts";
import { CODES, campaign, rhovanion } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";
import { nextPartId, nextPartStatus } from "../../../../test/harness/next-part.ts";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { checklist } from "../../checklist.ts";
import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS, poolEncounterCopies, wilderlandFacts } from "../../wilderland.ts";

let ctx: ReduceContext;
let cards: Awaited<ReturnType<typeof rhovanionWorld>>["cards"];
beforeAll(async () => {
  const world = await rhovanionWorld("strong");
  ctx = world.ctx;
  cards = world.cards;
}, 240_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// The game dealt and its Setup played: the mulligan is kept and each question is answered by `answer` (the first option by default).
function opened(start: ReturnType<typeof rhovanionStart>, answer?: (options: readonly string[]) => string): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: answer ? answer(state.window.options) : (state.window.options[0] ?? "") }, ctx)).state;
  return state;
}

const golden = (name: string) => RHOVANION_GOLDENS.find((item) => item.name.startsWith(name))!;

// Each test deals a game or two from the earlier parts' logs; under a loaded run they pass 5 s, so the file gives them a minute (phase 53 to 55 did the same for their campaign tests).
describe("Roam Across Rhovanion in the ered-mithrin campaign", { timeout: 60_000 }, () => {
  it("is part 5 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(rhovanion.id)).toBe(4);
    expect(rhovanion.campaignCard).toBe(CODES.campaignCard);
    expect(campaign.scenarios[3]).toBe("the-withered-heath");
    expect(campaign.scenarios[5]).toBe("fire-in-the-night");
  });

  it("is playable, and the path offers it after the first four parts and Fire in the Night after it", () => {
    expect(PLAYABLE_SCENARIOS).toContain(rhovanion.id);
    const fresh = campaignPath(campaign, {}, newSave("rhovanion", campaign.id, 1).log);
    expect(fresh[4]).toMatchObject({ id: rhovanion.id, status: expect.not.stringMatching(/completed/) });
    const path = campaignPath(campaign, {}, afterHeath(2));
    expect(path.slice(0, 6).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "current", expect.not.stringMatching(/completed|current/)]);
  });

  it("deals the Campaign Setup from a blank log: the campaign card on the table, no ally to search, no removal, and Urdug under the first player with the trust to ask", () => {
    const plan = rhovanionPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.removedFromEncounter).toEqual([]);
    const state = opened(rhovanionStart(1, 1, "Normal"));
    expect(where(state, CODES.campaignCard)[0]).toMatchObject({ zone: "campaign" });
    expect(where(state, CODES.urdug)[0]).toMatchObject({ zone: "play", controller: 0, resources: 1 });
    // The first answer, "trust", put a resource on him; the other question is the burden.
    const declined = opened(rhovanionStart(1, 1, "Normal"), () => "burden");
    expect(where(declined, CODES.urdug)[0]?.resources).toBe(0);
    expect(where(declined, CODES.urdugSCunning)).toHaveLength(1);
  });

  it("hands the earlier parts' Resolutions to the game (the allies, the burdens and Abandoned Ruin in the pool, the Accolade and Song boons, the pooled encounter cards, the treasures), through the Campaign Setup Checklist", () => {
    const log = rawEarlier(2);
    expect(log.completed).toEqual(["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath"]);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([CODES.turayn, CODES.melanwar, CODES.isolde, CODES.abandonedRuin, CODES.threatToWilderland]));
    // The Withered Heath's Resolution: a Song boon for each player is in the pool.
    expect(log.campaignPool.some((card) => ["12180", "12181", "12182", "12183"].includes(card.code))).toBe(true);
    expect(log.allyLines ?? []).toEqual([]);
    expect(log.treasures?.length).toBeGreaterThanOrEqual(3);
    expect(poolEncounterCopies(log.encounterPool ?? {})).toContain("01089");
    // The checklist reads the same log as the game does.
    const facts = wilderlandFacts(log, campaign.id);
    expect(facts.treasures).toEqual(log.treasures);
    expect(facts.encounterPool).toEqual(log.encounterPool);
    const given = afterHeath(2);
    const answers = rhovanionSetupChoices(2, given, "Normal");
    const state = opened(rhovanionStart(2, 3, "Normal", undefined, given, undefined, answers));
    expect(state.campaignFacts?.treasures).toEqual(given.treasures);
    expect(state.campaignFacts?.encounterPool).toEqual(given.encounterPool);
    // The pool's encounter cards are dealt with this scenario's own copies; The Threat to Wilderland enters the staging area at its Setup and Abandoned Ruin waits with the burdens.
    const base = opened(rhovanionStart(2, 3, "Normal", undefined, emptyLog(2), undefined, []));
    for (const [code, copies] of Object.entries(given.encounterPool ?? {})) expect(where(state, code), code).toHaveLength(where(base, code).length + copies);
    expect(where(state, CODES.threatToWilderland)).toHaveLength(1);
    // The Song boons and the Accolade boons the pool holds are in the players' decks or hands (after the starting hand) or on their heroes.
    for (const card of given.campaignPool.filter((item) => item.back === "player")) expect(where(state, card.code).length, card.code).toBeGreaterThanOrEqual(1);
  });

  it("asks the first player for the boon ally search (12184:A:2): the pool's allies are offered, the one taken goes to the hand after the mulligan, and a skip takes none", () => {
    const given = afterHeath(2);
    // Without an answer the checklist stops at the first seat's offer: Turayn, Melanwar and Isolde, or skip.
    expect(() => rhovanionPlan(2, given)).toThrow();
    const asks = checklist({ log: given, scenario: campaignScenario(rhovanion), seats: rhovanionLoadout(2), effects: EFFECTS, cards });
    expect(!asks.ok && asks.needs).toMatchObject({ seat: 0, options: expect.arrayContaining([CODES.turayn, CODES.melanwar, CODES.isolde, "skip"]) });
    expect(!asks.ok && asks.needs?.note).toBe("Search your deck for a unique boon ally to add to your hand, or skip. It joins your hand after the mulligan, and if you take one no other player does.");
    const state = opened(rhovanionStart(2, 3, "Normal", undefined, given, undefined, [CODES.melanwar]));
    expect(codesOf(state, state.seats[0]!.hand)).toContain(CODES.melanwar);
    expect(codesOf(state, state.seats[0]!.deck)).not.toContain(CODES.melanwar);
    expect(where(state, CODES.melanwar)).toHaveLength(1);
    const skipped = opened(rhovanionStart(2, 3, "Normal", undefined, given, undefined, ["skip"]));
    expect(where(skipped, CODES.melanwar)[0]?.zone).not.toBe("setAside");
    expect(where(skipped, CODES.melanwar)).toHaveLength(1);
    expect(() => rhovanionPlan(2, given, [CODES.turayn, CODES.melanwar])).not.toThrow();
  });

  it("removes 3 non-unique enemies other than Grey Mountain Giant with Melanwar's line, each named by the first player, and never offers the Giant", () => {
    for (const [variant, seats] of [["oath", 1], ["oathline", 1], ["oath", 2]] as const) {
      const log = afterHeath(seats, variant);
      expect(log.allyLines, `${seats} ${variant}`).toContain("melanwar");
      const answers: string[] = [];
      for (let guard = 0; guard < 12; guard += 1) {
        const plan = checklist({ log, scenario: campaignScenario(rhovanion), seats: rhovanionLoadout(seats), effects: EFFECTS, cards, difficulty: "Normal", choices: answers });
        if (plan.ok) break;
        const needs = plan.needs;
        if (!needs) throw new Error(plan.errors.join("; "));
        const offered = needs.options.filter((option) => option !== "skip");
        // The Giant is not among the enemies that may be removed; each is a non-unique enemy.
        if (offered.length > 0 && cards.get(offered[0]!)?.type === "enemy") {
          expect(offered, `${seats} ${variant}`).not.toContain(CODES.greyMountainGiant);
          for (const code of offered) expect(cards.get(code)?.isUnique, code).not.toBe(true);
        }
        answers.push(offered[0] ?? "skip");
      }
      const plan = rhovanionPlan(seats, log, answers, "Normal");
      expect(plan.removedFromEncounter, `${seats} ${variant}`).toHaveLength(3);
      for (const code of plan.removedFromEncounter) {
        expect(cards.get(code)?.type, code).toBe("enemy");
        expect(code).not.toBe(CODES.greyMountainGiant);
      }
    }
  });

  it("puts the trust in Urdug after the quest card's Setup: Urdug is under the first player when the question is asked, and in a two-handed game it is the first player's alone", () => {
    for (const seats of [1, 2] as const) {
      const log = afterHeath(seats);
      let state = startScenario(rhovanionStart(seats, 2, "Normal", undefined, log, undefined, rhovanionSetupChoices(seats, log, "Normal")), ctx);
      while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
      expect(state.window?.kind, `${seats} seats`).toBe("choose");
      expect(state.window?.kind === "choose" ? state.window.options : []).toEqual(["trust", "burden"]);
      expect(state.window?.kind === "choose" ? state.window.seat : -1).toBe(state.firstPlayer);
      expect(where(state, CODES.urdug)[0]).toMatchObject({ zone: "play", controller: state.firstPlayer, resources: 0 });
      // After the Setup the quest card's staging locations are dealt; the trust shows the first answer.
      const trusted = expectOk(reduce(state, { type: "Choose", optionId: "trust" }, ctx)).state;
      expect(where(trusted, CODES.urdug)[0]?.resources).toBe(1);
    }
  });

  it("deals the original game in a standalone game: no campaign card, no trust to ask, Urdug under the first player, and no pool", () => {
    const start = buildStart({ campaign, scenario: rhovanion, seatCount: 1, seed: 1, threatModifier: 0, seats: rhovanionLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    expect(where(state, CODES.urdug)[0]).toMatchObject({ zone: "play", controller: 0, resources: 0 });
    for (const code of [CODES.urdugSCunning, CODES.misplacedTrust, CODES.abandonedRuin, CODES.threatToWilderland]) expect(where(state, code), code).toEqual([]);
  });

  it("writes Misplaced Trust or Urdug's Cunning, the copy of a location and the log to the campaign when won, unlocks Fire in the Night (coming soon), and writes nothing when lost", async () => {
    // Two-handed, after the earlier parts, 3 or more resources: a Misplaced Trust for each player joins the pool (after the starting hand), and a copy of each chosen location joins the pool's encounter cards.
    const win = golden("two-handed, won, after the earlier parts, Horn, Tiny, Key");
    const state = playGolden(win, ctx).state;
    const before = logBeforeGolden(win);
    const log = applyResolution(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual([...before.completed, rhovanion.id]);
    expect(log.completed).toHaveLength(5);
    const trust = log.campaignPool.filter((card) => card.code === CODES.misplacedTrust);
    expect(trust.map((card) => card.seat).sort()).toEqual([0, 1]);
    for (const card of trust) expect(card.afterHand, "shuffled in after the starting hand").toBe(true);
    expect(log.campaignPool.some((card) => card.code === CODES.urdugSCunning)).toBe(false);
    // The earlier parts' pool is still there beside the new cards.
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([CODES.turayn, CODES.melanwar, CODES.isolde, CODES.abandonedRuin]));
    const chosen = (state.resolutionLog.poolAnswers ?? []).map((item) => item.option);
    expect(chosen.length).toBeGreaterThan(0);
    for (const code of chosen) expect(log.encounterPool?.[code] ?? 0, code).toBeGreaterThan((before.encounterPool?.[code] ?? 0));
    // The path now offers the sixth part next, which the app cannot deal yet.
    const path = campaignPath(campaign, {}, log);
    expect(path.slice(0, 6).map((node) => [node.id, node.status === "completed"])).toEqual([["journey-up-the-anduin", true], ["lost-in-mirkwood", true], ["the-kings-quest", true], ["the-withered-heath", true], [rhovanion.id, true], [nextPartId(campaign, rhovanion.id), false]]);
    expect(path[5]?.status).toBe(nextPartStatus(campaign, rhovanion.id));
    expect(nextStep(path, null)).toMatchObject({ node: { id: "fire-in-the-night" } });
    // With fewer than 3 resources each player earns Urdug's Cunning, a burden, instead.
    const cunning = golden("two-handed, won, after the earlier parts, Key, Horn, Tiny, trust twice");
    const cunningState = playGolden(cunning, ctx).state;
    const written = applyResolution(logBeforeGolden(cunning), cunningState.scenarioId, cunningState, cards, NO_COPY_LIMITS);
    expect(written.campaignPool.filter((card) => card.code === CODES.urdugSCunning).map((card) => card.seat).sort()).toEqual([0, 1]);
    expect(written.campaignPool.some((card) => card.code === CODES.misplacedTrust)).toBe(false);
    // The lines written by the earlier parts stay on the log.
    const lined = golden("two-handed, Easy, won, Melanwar's and Isolde's lines, Horn");
    const lineState = playGolden(lined, ctx).state;
    const linedLog = applyResolution(logBeforeGolden(lined), lineState.scenarioId, lineState, cards, NO_COPY_LIMITS);
    expect(linedLog.allyLines).toEqual(expect.arrayContaining(["turayn", "melanwar", "isolde"]));
    expect(linedLog.completed).toHaveLength(5);
    // A loss writes nothing.
    const lostGolden = RHOVANION_GOLDENS.find((item) => item.outcome === "lost")!;
    const weak = await rhovanionWorld(lostGolden.decks);
    const lost = playGolden(lostGolden, weak.ctx).state;
    expect(lost.lost).toBe(true);
    const blank = emptyLog(lostGolden.seatCount);
    expect(applyResolution(blank, lost.scenarioId, lost, weak.cards, NO_COPY_LIMITS)).toBe(blank);
  }, 180_000);

  it("the answers the Setup is asked match the goldens' log", () => {
    for (const item of RHOVANION_GOLDENS.filter((entry) => entry.after)) expect(() => rhovanionChoices(item), item.name).not.toThrow();
    expect(rhovanionChoices(RHOVANION_GOLDENS.find((entry) => entry.ally === "skip")!)[0]).toBe("skip");
  });
});

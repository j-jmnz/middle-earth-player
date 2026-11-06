// Rules: emce.setup-fire-in-the-night, emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, emce.campaign-log, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.setup (data/rules/entries.json).
// Fire in the Night in the Ered Mithrin campaign: it is the sixth part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. The five earlier parts' real Resolutions (Journey Up the Anduin's, Lost in Mirkwood's,
// The King's Quest's, The Withered Heath's and Roam Across Rhovanion's golden wins, applied one after the other to a blank log) are what reaches it: the allies in a player's pool or their lines, the burdens, Misplaced Trust or Urdug's Cunning, the copy of a location Roam Across
// Rhovanion pooled, the Accolade and Song boons, the treasures discovered, all through the Campaign Setup Checklist, whose Turayn and Isolde removals this part adds. Winning this part runs its Resolution (Beldis in the pool or his line, the treasure for 5 progress, the cards
// each player removes from the pool, the boxes marked beside Beldis) and unlocks The Ghost of Framsburg (coming soon); a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { NIGHT_GOLDENS, afterRhovanion, logBeforeGolden, nightChoices, nightLoadout, nightPlan, nightSetupChoices, nightStart, nightWorld, playGolden, rawEarlier } from "../../../../test/scenarios/fire-in-the-night/game.ts";
import { CODES, campaign, night } from "../../../../test/scenarios/fire-in-the-night/scene.ts";
import { CODES as ROAM } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";
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
let cards: Awaited<ReturnType<typeof nightWorld>>["cards"];
beforeAll(async () => {
  const world = await nightWorld("strong");
  ctx = world.ctx;
  cards = world.cards;
}, 240_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The game dealt and its Setup played: the mulligan is kept and each question is answered with its first option.
function opened(start: ReturnType<typeof nightStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

const golden = (name: string) => NIGHT_GOLDENS.find((item) => item.name.startsWith(name))!;

// Each test deals a game or two from the earlier parts' logs; under a loaded run they pass 5 s, so the file gives them a minute (phases 53 to 56 did the same for their campaign tests).
describe("Fire in the Night in the ered-mithrin campaign", { timeout: 60_000 }, () => {
  it("is part 6 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(night.id)).toBe(5);
    expect(night.campaignCard).toBe(CODES.campaignCard);
    expect(campaign.scenarios[4]).toBe("roam-across-rhovanion");
    expect(campaign.scenarios[6]).toBe("the-ghost-of-framsburg");
  });

  it("is playable, and the path offers it after the first five parts and The Ghost of Framsburg after it", () => {
    expect(PLAYABLE_SCENARIOS).toContain(night.id);
    const fresh = campaignPath(campaign, {}, newSave("night", campaign.id, 1).log);
    expect(fresh[5]).toMatchObject({ id: night.id, status: expect.not.stringMatching(/completed/) });
    const path = campaignPath(campaign, {}, afterRhovanion(2));
    expect(path.slice(0, 7).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "completed", "current", expect.not.stringMatching(/completed|current/)]);
  });

  it("deals the Campaign Setup from a blank log: the campaign card on the table, Beldis under the first player, nothing searched for and nothing removed", () => {
    const plan = nightPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.removedFromEncounter).toEqual([]);
    for (const seats of [1, 2] as const) {
      const state = opened(nightStart(seats, 1, "Normal"));
      expect(where(state, CODES.campaignCard)[0], `${seats} seats`).toMatchObject({ zone: "campaign" });
      expect(where(state, CODES.beldis)[0], `${seats} seats`).toMatchObject({ zone: "play", controller: state.firstPlayer });
      expect(state.piles?.sideQuestDeck, `${seats} seats`).toHaveLength(8);
    }
  });

  it("hands the earlier parts' Resolutions to the game: the allies, the burdens, Misplaced Trust or Urdug's Cunning, the copy of a location Roam Across Rhovanion pooled, the Accolade and Song boons and the treasures, through the Campaign Setup Checklist", () => {
    for (const variant of ["pool", "cunning"] as const) {
      const log = rawEarlier(2, variant);
      expect(log.completed, variant).toEqual(["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion"]);
      const trust = variant === "pool" ? ROAM.misplacedTrust : ROAM.urdugSCunning;
      const other = variant === "pool" ? ROAM.urdugSCunning : ROAM.misplacedTrust;
      // Roam Across Rhovanion's Resolution: a Misplaced Trust (3 or more resources on Urdug) or an Urdug's Cunning for each player, and a copy of the locations the players chose.
      expect(log.campaignPool.filter((card) => card.code === trust).map((card) => card.seat).sort(), variant).toEqual([0, 1]);
      expect(log.campaignPool.some((card) => card.code === other), variant).toBe(false);
      expect(log.campaignPool.map((card) => card.code), variant).toEqual(expect.arrayContaining([ROAM.abandonedRuin, ROAM.threatToWilderland]));
      expect(poolEncounterCopies(log.encounterPool ?? {}).length, variant).toBeGreaterThanOrEqual(1);
      expect(log.treasures.length, variant).toBeGreaterThanOrEqual(3);
      // The checklist reads the same log as the game does.
      const facts = wilderlandFacts(log, campaign.id);
      expect(facts.treasures).toEqual(log.treasures);
      expect(facts.encounterPool).toEqual(log.encounterPool);
      const given = afterRhovanion(2, variant);
      const state = opened(nightStart(2, 3, "Normal", undefined, given, undefined, nightSetupChoices(2, given, "Normal")));
      expect(state.campaignFacts?.treasures, variant).toEqual(given.treasures);
      expect(state.campaignFacts?.encounterPool, variant).toEqual(given.encounterPool);
      // The pool's encounter cards are dealt with this scenario's own copies; Urdug's Cunning is shuffled into the encounter deck (a burden), The Threat to Wilderland enters the staging area and Abandoned Ruin waits with the burdens.
      const base = opened(nightStart(2, 3, "Normal", undefined, emptyLog(2), undefined, []));
      for (const [code, copies] of Object.entries(given.encounterPool ?? {})) expect(where(state, code), `${variant} ${code}`).toHaveLength(where(base, code).length + copies);
      expect(where(state, ROAM.threatToWilderland), variant).toHaveLength(1);
      expect(where(state, trust).length, variant).toBe(2);
      if (variant === "cunning") for (const card of where(state, ROAM.urdugSCunning)) expect(card.zone).toBe("encounterDeck");
      // The Song boons and the Accolade boons the pool holds are in the players' decks or hands (after the starting hand) or on their heroes.
      for (const card of given.campaignPool.filter((item) => item.back === "player")) expect(where(state, card.code).length, `${variant} ${card.code}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("asks the first player for the cards Turayn's oath and Isolde's line remove (12187:A:2): 3 non-unique locations, then 3 non-unique enemies, each named in turn, and never a unique card", () => {
    for (const [seats, variant] of [[1, "oath"], [1, "oathline"], [2, "oath"]] as const) {
      const log = afterRhovanion(seats, variant);
      expect(log.allyLines, `${seats} ${variant}`).toEqual(expect.arrayContaining(["turayn"]));
      const answers: string[] = [];
      for (let guard = 0; guard < 12; guard += 1) {
        const plan = checklist({ log, scenario: campaignScenario(night), seats: nightLoadout(seats), effects: EFFECTS, cards, difficulty: "Normal", choices: answers });
        if (plan.ok) break;
        const needs = plan.needs;
        if (!needs) throw new Error(plan.errors.join("; "));
        const kind = answers.length < 3 ? "location" : "enemy";
        for (const code of needs.options) {
          expect(cards.get(code)?.type, `${seats} ${variant} ${code}`).toBe(kind);
          expect(cards.get(code)?.isUnique, code).not.toBe(true);
        }
        // Each search names a card; a title the deck holds twice may be named twice, and the helper takes a new one each time.
        answers.push(needs.options.find((code) => !answers.includes(code)) ?? needs.options[0] ?? "");
      }
      const plan = nightPlan(seats, log, answers, "Normal");
      const expected = (log.allyLines ?? []).includes("isolde") ? 6 : 3;
      expect(plan.removedFromEncounter, `${seats} ${variant}`).toHaveLength(expected);
      expect(nightSetupChoices(seats, log, "Normal")).toEqual(answers);
      // The removed cards are not in the encounter deck of the game dealt.
      const removed = plan.removedFromEncounter.filter((code, index, all) => all.indexOf(code) === index);
      const state = opened(nightStart(seats, 2, "Normal", undefined, log, undefined, answers));
      const base = opened(nightStart(seats, 2, "Normal", undefined, { ...log, allyLines: [] }, undefined, []));
      for (const code of removed) expect(where(state, code).filter((card) => card.zone === "encounterDeck").length, code).toBeLessThan(where(base, code).filter((card) => card.zone === "encounterDeck").length);
    }
  });

  it("deals the original game in a standalone game: no campaign card, no Beldis, no pool, and Dagnir with his side quests", () => {
    const start = buildStart({ campaign, scenario: night, seatCount: 1, seed: 1, threatModifier: 0, seats: nightLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    expect(where(state, CODES.beldis)).toEqual([]);
    expect(where(state, CODES.dagnir)[0]).toMatchObject({ zone: "staging" });
    expect(state.piles?.sideQuestDeck).toHaveLength(8);
    for (const code of [ROAM.urdugSCunning, ROAM.misplacedTrust, ROAM.abandonedRuin, ROAM.threatToWilderland]) expect(where(state, code), code).toEqual([]);
  });

  it("writes Beldis, the treasure, the cards removed from the pool, the boxes beside Beldis and the log to the campaign when won, unlocks The Ghost of Framsburg (coming soon), and keeps the earlier parts' pool", () => {
    // Two-handed, after the earlier parts, the pool's cards removed: the earlier parts' pool stays beside Beldis, minus what each player removed, and the treasure chosen is discovered.
    const win = golden("two-handed, won, after the earlier parts, Misplaced Trust");
    const state = playGolden(win, ctx).state;
    const before = logBeforeGolden(win);
    const log = applyResolution(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual([...before.completed, night.id]);
    expect(log.completed).toHaveLength(6);
    expect(log.campaignPool.filter((card) => card.code === CODES.beldis)).toHaveLength(1);
    expect(log.campaignPool.filter((card) => card.code === ROAM.misplacedTrust).map((card) => card.seat).sort()).toEqual([0, 1]);
    const removed = state.resolutionLog.poolRemoved ?? [];
    expect(removed).toHaveLength(2);
    for (const item of removed) expect(log.campaignPool.filter((card) => card.code === item.code && card.seat === item.seat), item.code).toEqual([]);
    expect(log.treasures).toHaveLength(before.treasures.length + 1);
    expect(log.treasures).toEqual(expect.arrayContaining([...before.treasures]));
    expect(log.allyLines).toEqual(before.allyLines);
    // The path now offers the seventh part next, which the app cannot deal yet.
    const path = campaignPath(campaign, {}, log);
    expect(path.slice(0, 7).map((node) => [node.id, node.status === "completed"])).toEqual([...campaign.scenarios.slice(0, 6).map((id) => [id, true]), [nextPartId(campaign, night.id), false]]);
    expect(path[6]?.status).toBe(nextPartStatus(campaign, night.id));
    expect(nextStep(path, null)).toMatchObject({ node: { id: "the-ghost-of-framsburg" } });
    expect(nextPartStatus(campaign, night.id)).toBe("soon");
    // Beldis's line, written instead of the ally, with the boxes beside her marked by the players who used her.
    const healed = golden("two-handed, Easy, won from a blank log, Hill attack defended, enemies engaged, Beldis heals");
    const healedState = playGolden(healed, ctx).state;
    expect(healedState.campaignFacts?.beldisUses?.some((used) => used > 0)).toBe(true);
    expect(applyResolution(emptyLog(2), healedState.scenarioId, healedState, cards, NO_COPY_LIMITS).beldisUses).toEqual(healedState.campaignFacts?.beldisUses);
    const lined = golden("two-handed, won from a blank log, every other round, Hill attack defended, the last treasure, Beldis's line");
    const linedState = playGolden(lined, ctx).state;
    const linedLog = applyResolution(emptyLog(2), linedState.scenarioId, linedState, cards, NO_COPY_LIMITS);
    expect(linedLog.allyLines).toContain("beldis");
    expect(linedLog.campaignPool.some((card) => card.code === CODES.beldis)).toBe(false);
    expect(linedLog.treasures).toHaveLength(1);
    // A Resolution that removes nothing leaves the pool as the earlier parts wrote it.
    const kept = golden("two-handed, Easy, won, Melanwar's and Isolde's lines");
    const keptState = playGolden(kept, ctx).state;
    const keptBefore = logBeforeGolden(kept);
    const keptLog = applyResolution(keptBefore, keptState.scenarioId, keptState, cards, NO_COPY_LIMITS);
    expect(keptLog.allyLines).toEqual(expect.arrayContaining(["turayn", "melanwar", "isolde"]));
    expect(keptLog.completed).toHaveLength(6);
  }, 180_000);

  it("writes nothing when lost: the log is the one the game started from", async () => {
    for (const lostGolden of NIGHT_GOLDENS.filter((item) => item.outcome === "lost" && (item.after || item.decks !== "strong")).slice(0, 4)) {
      const world = await nightWorld(lostGolden.decks);
      const lost = playGolden(lostGolden, world.ctx).state;
      expect(lost.lost, lostGolden.name).toBe(true);
      const before = logBeforeGolden(lostGolden);
      expect(applyResolution(before, lost.scenarioId, lost, world.cards, NO_COPY_LIMITS), lostGolden.name).toBe(before);
    }
  }, 180_000);

  it("the answers the Setup is asked match the goldens' log", () => {
    for (const item of NIGHT_GOLDENS.filter((entry) => entry.after)) expect(() => nightChoices(item), item.name).not.toThrow();
    expect(nightChoices(NIGHT_GOLDENS.find((entry) => entry.variant === "oathline")!)).toHaveLength(6);
    expect(nightChoices(NIGHT_GOLDENS.find((entry) => !entry.after)!)).toEqual([]);
  });
});

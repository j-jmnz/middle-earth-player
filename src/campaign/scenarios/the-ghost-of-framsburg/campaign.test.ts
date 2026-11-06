// Rules: emce.setup-the-ghost-of-framsburg, emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, emce.campaign-log, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.setup (data/rules/entries.json).
// The Ghost of Framsburg in the Ered Mithrin campaign: it is the seventh part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. The six earlier parts' real Resolutions (Journey Up the Anduin's, Lost in Mirkwood's, The
// King's Quest's, The Withered Heath's, Roam Across Rhovanion's and Fire in the Night's golden wins, applied one after the other to a blank log) are what reaches it: the allies in a player's pool or their lines, the burdens, Misplaced Trust or Urdug's Cunning, the copies of encounter
// cards the pool tallies, the Accolade and Song boons, the treasures discovered, all through the Campaign Setup Checklist, whose Isolde and Beldis removals this part adds. Winning this part runs its Resolution (Gundabad Hunter or Gundabad Stalker and one of the first 2 Hazard cards
// discarded in the pool, the treasures the players control discovered) and unlocks Mount Gundabad, which is coming soon; a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { FRAMSBURG_GOLDENS, afterNight, framsburgChoices, framsburgLoadout, framsburgPlan, framsburgSetupChoices, framsburgStart, framsburgWorld, logBeforeGolden, playGolden, rawEarlier } from "../../../../test/scenarios/the-ghost-of-framsburg/game.ts";
import { CODES, campaign, framsburg } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";
import { CODES as NIGHT } from "../../../../test/scenarios/fire-in-the-night/scene.ts";
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
let cards: Awaited<ReturnType<typeof framsburgWorld>>["cards"];
beforeAll(async () => {
  const world = await framsburgWorld("strong");
  ctx = world.ctx;
  cards = world.cards;
}, 240_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The game dealt and its Setup played: the mulligan is kept and each question is answered with its first option.
function opened(start: ReturnType<typeof framsburgStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

const golden = (name: string) => FRAMSBURG_GOLDENS.find((item) => item.name.startsWith(name))!;

// Each test deals a game or two from the earlier parts' logs; under a loaded run they pass 5 s, so the file gives them a minute (phases 53 to 57 did the same for their campaign tests).
describe("The Ghost of Framsburg in the ered-mithrin campaign", { timeout: 60_000 }, () => {
  it("is part 7 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(framsburg.id)).toBe(6);
    expect(framsburg.campaignCard).toBe(CODES.campaignCard);
    expect(campaign.scenarios[5]).toBe("fire-in-the-night");
    expect(campaign.scenarios[7]).toBe("mount-gundabad");
  });

  it("is playable, and the path offers it after the first six parts and Mount Gundabad after it", () => {
    expect(PLAYABLE_SCENARIOS).toContain(framsburg.id);
    const fresh = campaignPath(campaign, {}, newSave("framsburg", campaign.id, 1).log);
    expect(fresh[6]).toMatchObject({ id: framsburg.id, status: expect.not.stringMatching(/completed/) });
    const path = campaignPath(campaign, {}, afterNight(2));
    expect(path.slice(0, 8).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "completed", "completed", "current", expect.not.stringMatching(/completed|current/)]);
  });

  it("deals the Campaign Setup from a blank log: the campaign card on the table, Ashen Brazier, Gundabad Hunter and Gundabad Stalker in the encounter deck, nothing removed", () => {
    const plan = framsburgPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.removedFromEncounter).toEqual([]);
    for (const seats of [1, 2] as const) {
      const state = opened(framsburgStart(seats, 1, "Normal"));
      expect(where(state, CODES.campaignCard)[0], `${seats} seats`).toMatchObject({ zone: "campaign" });
      for (const code of [CODES.ashenBrazier, CODES.gundabadHunter, CODES.gundabadStalker]) expect(where(state, code), `${seats} seats ${code}`).toMatchObject([{ zone: "encounterDeck" }]);
    }
  });

  it("hands the earlier parts' Resolutions to the game: the allies, the burdens, Misplaced Trust or Urdug's Cunning, the encounter cards the pool tallies, the Accolade and Song boons and the treasures, through the Campaign Setup Checklist", () => {
    for (const variant of ["pool", "cunning"] as const) {
      const log = rawEarlier(2, variant);
      expect(log.completed, variant).toEqual(["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night"]);
      const trust = variant === "pool" ? ROAM.misplacedTrust : ROAM.urdugSCunning;
      expect(log.campaignPool.filter((card) => card.code === trust).map((card) => card.seat).sort(), variant).toEqual([0, 1]);
      // Fire in the Night's Resolution: Beldis for a player, or his line.
      expect(log.campaignPool.some((card) => card.code === NIGHT.beldis) || (log.allyLines ?? []).includes("beldis"), variant).toBe(true);
      if (variant === "pool") expect(poolEncounterCopies(log.encounterPool ?? {}).length, variant).toBeGreaterThanOrEqual(1);
      expect(log.treasures.length, variant).toBeGreaterThanOrEqual(3);
      // The checklist reads the same log as the game does.
      const facts = wilderlandFacts(log, campaign.id);
      expect(facts.treasures).toEqual(log.treasures);
      expect(facts.encounterPool ?? {}).toEqual(log.encounterPool ?? {});
      const given = afterNight(2, variant);
      const state = opened(framsburgStart(2, 3, "Normal", undefined, given, undefined, framsburgSetupChoices(2, given, "Normal")));
      expect(state.campaignFacts?.treasures, variant).toEqual(given.treasures);
      expect(state.campaignFacts?.encounterPool ?? {}, variant).toEqual(given.encounterPool ?? {});
      // The pool's encounter cards are dealt with this scenario's own copies.
      const base = opened(framsburgStart(2, 3, "Normal", undefined, emptyLog(2), undefined, []));
      for (const [code, copies] of Object.entries(given.encounterPool ?? {})) expect(where(state, code), `${variant} ${code}`).toHaveLength(where(base, code).length + copies);
      expect(where(state, trust).length, variant).toBe(2);
      for (const card of given.campaignPool.filter((item) => item.back === "player")) expect(where(state, card.code).length, `${variant} ${card.code}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("asks the first player for the cards Isolde's and Beldis's lines remove (12189:A:2): 3 treacheries, then 3 non-unique locations, each named in turn, and never a unique card", () => {
    for (const [seats, variant] of [[1, "oathline"], [1, "beldis"], [2, "oath"]] as const) {
      const log = afterNight(seats, variant);
      const lines = log.allyLines ?? [];
      const answers: string[] = [];
      for (let guard = 0; guard < 12; guard += 1) {
        const plan = checklist({ log, scenario: campaignScenario(framsburg), seats: framsburgLoadout(seats), effects: EFFECTS, cards, difficulty: "Normal", choices: answers });
        if (plan.ok) break;
        const needs = plan.needs;
        if (!needs) throw new Error(plan.errors.join("; "));
        // The first question is the search for a unique boon ally (12189:A:2); then the treacheries Isolde's line removes, then the locations Beldis's removes.
        const searched = answers.filter((code) => cards.get(code)?.type === "ally").length;
        const kind = searched === 0 ? "ally" : lines.includes("isolde") && answers.length - searched < 3 ? "treachery" : "location";
        for (const code of needs.options.filter((option) => option !== "skip")) {
          expect(cards.get(code)?.type, `${seats} ${variant} ${code}`).toBe(kind);
          if (kind !== "ally") expect(cards.get(code)?.isUnique, code).not.toBe(true);
        }
        answers.push(needs.options.filter((option) => option !== "skip").find((code) => !answers.includes(code)) ?? "skip");
      }
      const plan = framsburgPlan(seats, log, answers, "Normal");
      expect(plan.removedFromEncounter, `${seats} ${variant}`).toHaveLength((lines.includes("isolde") ? 3 : 0) + (lines.includes("beldis") ? 3 : 0));
      expect(framsburgSetupChoices(seats, log, "Normal")).toEqual(answers);
      // The removed cards are not in the encounter deck of the game dealt.
      const removed = plan.removedFromEncounter.filter((code, index, all) => all.indexOf(code) === index);
      const state = opened(framsburgStart(seats, 2, "Normal", undefined, log, undefined, answers));
      const base = opened(framsburgStart(seats, 2, "Normal", undefined, { ...log, allyLines: [] }, undefined, ["skip"]));
      for (const code of removed) expect(where(state, code).filter((card) => card.zone === "encounterDeck").length, code).toBeLessThan(where(base, code).filter((card) => card.zone === "encounterDeck").length);
    }
  });

  it("deals the original game in a standalone game: no campaign card, no Ashen Brazier, Gundabad Hunter or Gundabad Stalker, no pool", () => {
    const start = buildStart({ campaign, scenario: framsburg, seatCount: 1, seed: 1, threatModifier: 0, seats: framsburgLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    for (const code of [CODES.ashenBrazier, CODES.gundabadHunter, CODES.gundabadStalker, ROAM.urdugSCunning, ROAM.misplacedTrust]) expect(where(state, code), code).toEqual([]);
    expect(where(state, CODES.theCursedTomb)[0]).toMatchObject({ zone: "setAside" });
  });

  it("writes Gundabad Hunter or Stalker, the Hazard card and the treasure to the campaign when won, keeps the earlier parts' pool and unlocks Mount Gundabad, which is coming soon", () => {
    // Two-handed, after the earlier parts, a treasure attached to Fram's Shade and claimed: the earlier pool stays and the Hunter joins it.
    const win = golden("two-handed, won, after the earlier parts, Urdug's Cunning");
    const state = playGolden(win, ctx).state;
    const before = logBeforeGolden(win);
    const log = applyResolution(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual([...before.completed, framsburg.id]);
    expect(log.completed).toHaveLength(7);
    expect(log.campaignPool.filter((card) => card.code === CODES.gundabadHunter)).toHaveLength(1);
    expect(log.campaignPool.filter((card) => card.code === ROAM.urdugSCunning).map((card) => card.seat).sort()).toEqual([0, 1]);
    expect(log.treasures).toHaveLength(before.treasures.length + 1);
    expect(log.treasures).toEqual(expect.arrayContaining([...before.treasures]));
    expect(Object.keys(log.encounterPool ?? {}).length).toBeGreaterThanOrEqual(Object.keys(before.encounterPool ?? {}).length);
    expect(log.allyLines).toEqual(before.allyLines);
    // The path now offers the eighth part next: Mount Gundabad, which the app cannot deal yet.
    const path = campaignPath(campaign, {}, log);
    expect(path.slice(0, 8).map((node) => [node.id, node.status === "completed"])).toEqual([...campaign.scenarios.slice(0, 7).map((id) => [id, true]), [nextPartId(campaign, framsburg.id), false]]);
    expect(path[7]?.status).toBe(nextPartStatus(campaign, framsburg.id));
    expect(nextStep(path, null)).toMatchObject({ node: { id: "mount-gundabad" } });
    // Gundabad Stalker for the pool, the Hazard card a burden: both burdens join the pool.
    const both = golden("true solo, Easy, won, Melanwar's and Isolde's lines, a burden");
    const bothState = playGolden(both, ctx).state;
    const bothLog = applyResolution(logBeforeGolden(both), bothState.scenarioId, bothState, cards, NO_COPY_LIMITS);
    expect(bothLog.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([CODES.gundabadHunter, CODES.gundabadStalker]));
  }, 180_000);

  it("writes nothing when lost: the log is the one the game started from", async () => {
    for (const lostGolden of FRAMSBURG_GOLDENS.filter((item) => item.outcome === "lost" && (item.after || item.decks !== "strong")).slice(0, 4)) {
      const world = await framsburgWorld(lostGolden.decks);
      const lost = playGolden(lostGolden, world.ctx).state;
      expect(lost.lost, lostGolden.name).toBe(true);
      const before = logBeforeGolden(lostGolden);
      expect(applyResolution(before, lost.scenarioId, lost, world.cards, NO_COPY_LIMITS), lostGolden.name).toBe(before);
    }
  }, 180_000);

  it("the answers the Setup is asked match the goldens' log", () => {
    for (const item of FRAMSBURG_GOLDENS.filter((entry) => entry.after)) expect(() => framsburgChoices(item), item.name).not.toThrow();
    expect(framsburgChoices(FRAMSBURG_GOLDENS.find((entry) => entry.variant === "oathline")!)).toHaveLength(4);
    // A blank log asks only for the search for a unique boon ally, which the pool does not hold.
    expect(framsburgChoices(FRAMSBURG_GOLDENS.find((entry) => !entry.after)!)).toEqual([]);
  });
});

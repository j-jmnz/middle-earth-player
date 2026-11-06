// Rules: emce.setup-mount-gundabad, emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, emce.campaign-log, emce.caves-deck-gundabad, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.setup (data/rules/entries.json).
// Mount Gundabad in the Ered Mithrin campaign: it is the eighth part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. The seven earlier parts' real Resolutions (Journey Up the Anduin's, Lost in Mirkwood's, The King's
// Quest's, The Withered Heath's, Roam Across Rhovanion's, Fire in the Night's and The Ghost of Framsburg's golden wins, applied one after the other to a blank log) are what reaches it: the allies in a player's pool or their lines, the burdens, Misplaced Trust or Urdug's Cunning, the copies
// of encounter cards the pool tallies, the Accolade and Song boons, the treasures discovered, all through the Campaign Setup Checklist, whose Melanwar and Beldis removals this part adds. Winning this part runs its Resolution (a treasure of 3, the treasures the players control discovered,
// A Growing Threat removed from the pool and, with 6 or more treasures logged, Dragon-sickness added to it) and unlocks The Fate of Wilderland, which is coming soon; a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { GUNDABAD_GOLDENS, afterFramsburg, gundabadChoices, gundabadLoadout, gundabadPlan, gundabadSetupChoices, gundabadStart, gundabadWorld, logBeforeGolden, playGolden, rawEarlier } from "../../../../test/scenarios/mount-gundabad/game.ts";
import { CODES, campaign, gundabad } from "../../../../test/scenarios/mount-gundabad/scene.ts";
import { CODES as FRAMSBURG } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";
import { CODES as ROAM } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";
import { nextPartId, nextPartStatus } from "../../../../test/harness/next-part.ts";

import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS, poolEncounterCopies, wilderlandFacts } from "../../wilderland.ts";

let ctx: ReduceContext;
let cards: Awaited<ReturnType<typeof gundabadWorld>>["cards"];
beforeAll(async () => {
  const world = await gundabadWorld("strong");
  ctx = world.ctx;
  cards = world.cards;
}, 240_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The game dealt and its Setup played: the mulligan is kept and each question is answered with its first option.
function opened(start: ReturnType<typeof gundabadStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

const golden = (name: string) => GUNDABAD_GOLDENS.find((item) => item.name.startsWith(name))!;

// Each test deals a game or two from the earlier parts' logs; under a loaded run they pass 5 s, so the file gives them a minute (phases 53 to 58 did the same for their campaign tests).
describe("Mount Gundabad in the ered-mithrin campaign", { timeout: 60_000 }, () => {
  it("is part 8 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(gundabad.id)).toBe(7);
    expect(gundabad.campaignCard).toBe(CODES.campaignCard);
    expect(campaign.scenarios[6]).toBe("the-ghost-of-framsburg");
    expect(campaign.scenarios[8]).toBe("the-fate-of-wilderland");
  });

  it("is playable, and the path offers it after the first seven parts and The Fate of Wilderland after it as coming soon", () => {
    expect(PLAYABLE_SCENARIOS).toContain(gundabad.id);
    const fresh = campaignPath(campaign, {}, newSave("gundabad", campaign.id, 1).log);
    expect(fresh[7]).toMatchObject({ id: gundabad.id, status: expect.not.stringMatching(/completed/) });
    const path = campaignPath(campaign, {}, afterFramsburg(2));
    expect(path.slice(0, 9).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "completed", "completed", "completed", "current", expect.not.stringMatching(/completed|current/)]);
    expect(PLAYABLE_SCENARIOS).not.toContain("the-fate-of-wilderland");
    expect(path[8]).toMatchObject({ id: "the-fate-of-wilderland", status: "soon" });
  });

  it("deals the Campaign Setup from a blank log: the campaign card on the table, Dagnir in the staging area, The First Forge set aside, Dragon-sickness left out, nothing removed", () => {
    const plan = gundabadPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.removedFromEncounter).toEqual([]);
    expect(plan.removedFromCaves).toEqual([]);
    for (const seats of [1, 2] as const) {
      const state = opened(gundabadStart(seats, 1, "Normal"));
      expect(where(state, CODES.campaignCard)[0], `${seats} seats`).toMatchObject({ zone: "campaign" });
      expect(where(state, CODES.dagnir)[0], `${seats} seats`).toMatchObject({ zone: "staging" });
      expect(where(state, CODES.theFirstForge)[0], `${seats} seats`).toMatchObject({ zone: "setAside" });
      expect(where(state, CODES.dragonSickness), `${seats} seats`).toEqual([]);
      expect(where(state, CODES.wormsbane)).toHaveLength(1);
    }
  });

  it("hands the earlier parts' Resolutions to the game: the allies, the burdens, Misplaced Trust or Urdug's Cunning, the encounter cards the pool tallies, the Accolade and Song boons and the treasures, through the Campaign Setup Checklist", () => {
    for (const variant of ["pool", "cunning"] as const) {
      const log = rawEarlier(2, variant);
      expect(log.completed, variant).toEqual(["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg"]);
      const trust = variant === "pool" ? ROAM.misplacedTrust : ROAM.urdugSCunning;
      expect(log.campaignPool.filter((card) => card.code === trust).map((card) => card.seat).sort(), variant).toEqual([0, 1]);
      // The Ghost of Framsburg's Resolution: Gundabad Hunter or Gundabad Stalker joined the pool.
      expect(log.campaignPool.some((card) => card.code === FRAMSBURG.gundabadHunter || card.code === FRAMSBURG.gundabadStalker), variant).toBe(true);
      expect(poolEncounterCopies(log.encounterPool ?? {}).length, variant).toBeGreaterThanOrEqual(1);
      // The checklist reads the same log as the game does.
      const facts = wilderlandFacts(log, campaign.id);
      expect(facts.treasures).toEqual(log.treasures);
      expect(facts.encounterPool ?? {}).toEqual(log.encounterPool ?? {});
      const given = afterFramsburg(2, variant);
      const state = opened(gundabadStart(2, 3, "Normal", undefined, given, undefined, gundabadSetupChoices(2, given, "Normal")));
      expect(state.campaignFacts?.treasures, variant).toEqual(given.treasures);
      expect(state.campaignFacts?.encounterPool ?? {}, variant).toEqual(given.encounterPool ?? {});
      // The pool's encounter cards are dealt with this scenario's own copies.
      const base = opened(gundabadStart(2, 3, "Normal", undefined, emptyLog(2), undefined, []));
      for (const [code, copies] of Object.entries(given.encounterPool ?? {})) expect(where(state, code), `${variant} ${code}`).toHaveLength(where(base, code).length + copies);
      expect(where(state, trust).length, variant).toBe(2);
      for (const card of given.campaignPool.filter((item) => item.back === "player")) expect(where(state, card.code).length, `${variant} ${card.code}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("shuffles Dragon-sickness into the encounter deck with 6 or more treasures logged (12193:A:2), and not with 5", () => {
    const six = afterFramsburg(2, "cunning");
    expect(six.treasures.length).toBeGreaterThanOrEqual(6);
    expect(where(opened(gundabadStart(2, 2, "Normal", undefined, six, undefined, gundabadSetupChoices(2, six, "Normal"))), CODES.dragonSickness)).toMatchObject([{ zone: "encounterDeck" }]);
    const five = afterFramsburg(2, "pool");
    expect(five.treasures).toHaveLength(5);
    expect(where(opened(gundabadStart(2, 2, "Normal", undefined, five, undefined, gundabadSetupChoices(2, five, "Normal"))), CODES.dragonSickness)).toEqual([]);
  });

  it("asks the first player for the cards Melanwar's and Beldis's lines remove (12193:A:2): 2 non-unique locations and 1 Caves location, then 3 treacheries, each named in turn, and never a unique card", () => {
    for (const [seats, variant] of [[1, "oathline"], [1, "beldis"], [2, "oath"]] as const) {
      const log = afterFramsburg(seats, variant);
      const lines = log.allyLines ?? [];
      const answers = gundabadSetupChoices(seats, log, "Normal");
      const plan = gundabadPlan(seats, log, answers, "Normal");
      expect(plan.removedFromEncounter, `${seats} ${variant}`).toHaveLength((lines.includes("melanwar") ? 2 : 0) + (lines.includes("beldis") ? 3 : 0));
      expect(plan.removedFromCaves, `${seats} ${variant}`).toHaveLength(lines.includes("melanwar") ? 1 : 0);
      for (const code of plan.removedFromEncounter) {
        expect(cards.get(code)?.isUnique, code).not.toBe(true);
        expect(["location", "treachery"], code).toContain(cards.get(code)?.type);
      }
      for (const code of plan.removedFromCaves) expect(cards.get(code)?.type, code).toBe("location");
      if (lines.includes("beldis")) expect(plan.removedFromEncounter.filter((code) => cards.get(code)?.type === "treachery")).toHaveLength(3);
      if (lines.includes("melanwar")) expect(plan.removedFromEncounter.filter((code) => cards.get(code)?.type === "location")).toHaveLength(2);
      // The removed cards are not in the game dealt: fewer of each in the encounter deck than in a game with the lines unwritten.
      const removed = plan.removedFromEncounter.filter((code, index, all) => all.indexOf(code) === index);
      const state = opened(gundabadStart(seats, 2, "Normal", undefined, log, undefined, answers));
      const base = opened(gundabadStart(seats, 2, "Normal", undefined, { ...log, allyLines: [] }, undefined, ["skip"]));
      for (const code of removed) expect(where(state, code).filter((card) => card.zone === "encounterDeck").length, code).toBeLessThan(where(base, code).filter((card) => card.zone === "encounterDeck").length);
      for (const code of plan.removedFromCaves) expect(where(state, code).filter((card) => card.zone === "cavesDeck").length, code).toBeLessThan(where(base, code).filter((card) => card.zone === "cavesDeck").length);
    }
  });

  it("deals the original game in a standalone game: no campaign card, no Dragon-sickness, no pool", () => {
    const start = buildStart({ campaign, scenario: gundabad, seatCount: 1, seed: 1, threatModifier: 0, seats: gundabadLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    for (const code of [CODES.dragonSickness, ROAM.urdugSCunning, ROAM.misplacedTrust, FRAMSBURG.gundabadHunter, FRAMSBURG.gundabadStalker]) expect(where(state, code), code).toEqual([]);
    expect(where(state, CODES.theFirstForge)[0]).toMatchObject({ zone: "setAside" });
    expect(where(state, CODES.dagnir)[0]).toMatchObject({ zone: "staging" });
  });

  it("writes a treasure, the treasures the players control and Dragon-sickness to the campaign when won, keeps the earlier parts' pool and unlocks The Fate of Wilderland as coming soon", () => {
    // Two-handed, after the earlier parts, Urdug's Cunning, 6 treasures logged: the pool stays, the treasures are added and Dragon-sickness joins the pool.
    const win = golden("two-handed, won, after the earlier parts, Urdug's Cunning, Dragon-sickness in the encounter deck, a stage bypassed");
    const state = playGolden(win, ctx).state;
    const before = logBeforeGolden(win);
    const log = applyResolution(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual([...before.completed, gundabad.id]);
    expect(log.completed).toHaveLength(8);
    expect(log.treasures).toHaveLength(before.treasures.length + (state.resolutionLog.treasures?.length ?? 0));
    expect(log.treasures).toEqual(expect.arrayContaining([...before.treasures]));
    expect(log.treasures.length).toBeGreaterThanOrEqual(7);
    expect(log.campaignPool.filter((card) => card.code === ROAM.urdugSCunning).map((card) => card.seat).sort()).toEqual([0, 1]);
    expect(log.encounterPool?.[CODES.dragonSickness]).toBe(1);
    expect(log.allyLines).toEqual(before.allyLines);
    // The path now offers the ninth part next: The Fate of Wilderland, which is coming soon.
    const path = campaignPath(campaign, {}, log);
    expect(path.slice(0, 9).map((node) => [node.id, node.status === "completed"])).toEqual([...campaign.scenarios.slice(0, 8).map((id) => [id, true]), [nextPartId(campaign, gundabad.id), false]]);
    expect(path[8]?.status).toBe("soon");
    expect(nextPartStatus(campaign, gundabad.id)).toBe("soon");
    expect(nextStep(path, null)).toMatchObject({ kind: "soon", node: { id: "the-fate-of-wilderland" } });
  }, 180_000);

  it("removes A Growing Threat from the pool when won, and keeps it when lost; Dragon-sickness joins the pool only when the log reaches 6 treasures", () => {
    const win = golden("true solo, won, after the earlier parts, A Growing Threat in the pool");
    const before = logBeforeGolden(win);
    expect(before.encounterPool?.[CODES.aGrowingThreat]).toBe(1);
    const state = playGolden(win, ctx).state;
    expect(state.campaignFacts?.encounterPool?.[CODES.aGrowingThreat]).toBe(1);
    const log = applyResolution(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
    expect(log.encounterPool?.[CODES.aGrowingThreat]).toBeUndefined();
    // The other cards of the pool stay: the copies the earlier parts tallied.
    for (const [code, copies] of Object.entries(before.encounterPool ?? {})) if (code !== CODES.aGrowingThreat) expect(log.encounterPool?.[code], code).toBeGreaterThanOrEqual(copies);
    // Five treasures logged before and one discovered: the sixth brings Dragon-sickness to the pool (the Resolution reads the treasures just discovered, B:5 after B:2 and B:3).
    expect(before.treasures).toHaveLength(4);
    expect(log.treasures.length).toBe(before.treasures.length + (state.resolutionLog.treasures?.length ?? 0));
    expect(log.encounterPool?.[CODES.dragonSickness] ?? 0).toBe(log.treasures.length >= 6 ? 1 : 0);
    // Lost: nothing is written, A Growing Threat stays.
    const lost = golden("two-handed, lost after the earlier parts, Misplaced Trust, A Growing Threat stays in the pool");
    const lostState = playGolden(lost, ctx).state;
    expect(lostState.lost).toBe(true);
    const lostBefore = logBeforeGolden(lost);
    expect(applyResolution(lostBefore, lostState.scenarioId, lostState, cards, NO_COPY_LIMITS)).toBe(lostBefore);
    expect(lostBefore.encounterPool?.[CODES.aGrowingThreat]).toBe(1);
  }, 180_000);

  it("writes nothing when lost: the log is the one the game started from", () => {
    for (const lostGolden of GUNDABAD_GOLDENS.filter((item) => item.outcome === "lost" && (item.after || item.decks === "strong")).slice(0, 4)) {
      const lost = playGolden(lostGolden, ctx).state;
      expect(lost.lost, lostGolden.name).toBe(true);
      const before = logBeforeGolden(lostGolden);
      expect(applyResolution(before, lost.scenarioId, lost, cards, NO_COPY_LIMITS), lostGolden.name).toBe(before);
    }
  }, 180_000);

  it("the answers the Setup is asked match the goldens' log", () => {
    for (const item of GUNDABAD_GOLDENS.filter((entry) => entry.after)) expect(() => gundabadChoices(item), item.name).not.toThrow();
    // Melanwar's line: 2 non-unique locations and 1 Caves location; Beldis's: 3 treacheries, after the search for a unique boon ally.
    expect(gundabadChoices(GUNDABAD_GOLDENS.find((entry) => entry.variant === "oathline")!).length).toBeGreaterThanOrEqual(3);
    expect(gundabadChoices(GUNDABAD_GOLDENS.find((entry) => entry.variant === "beldis")!).length).toBeGreaterThanOrEqual(3);
    // A blank log asks only for the search for a unique boon ally, which the pool does not hold.
    expect(gundabadChoices(GUNDABAD_GOLDENS.find((entry) => !entry.after)!)).toEqual([]);
  });
});

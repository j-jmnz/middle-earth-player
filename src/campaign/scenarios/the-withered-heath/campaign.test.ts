// Rules: emce.setup-the-withered-heath, emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, emce.caves-deck, emce.dragon-signs, mec109.campaign-mode, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.setup (data/rules/entries.json).
// The Withered Heath in the Ered Mithrin campaign: it is the fourth part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. The three earlier parts' real Resolutions (Journey Up the Anduin's, Lost in
// Mirkwood's and The King's Quest's golden wins, applied one after the other to a blank log) are what reaches it: Turayn, Melanwar and Isolde in a player's pool or their lines, The Threat to Wilderland or Dagnir's Spawn, Abandoned Ruin, the encounter cards the parts
// pooled and the treasures discovered, all through the Campaign Setup Checklist, whose boon-ally search and Melanwar-line Caves removal this part adds. Winning this part runs its Resolution (Accolade boons, Song boons, a treasure) and unlocks Roam Across Rhovanion
// (coming soon); a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { undiscoveredTreasures } from "../../../rules/families/wilderland/treasure.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { HEATH_GOLDENS, afterKingsquest, heathLoadout, heathPlan, heathSetupChoices, heathStart, heathWorld, logBeforeGolden, rawEarlier } from "../../../../test/scenarios/the-withered-heath/game.ts";
import { CODES, TREASURES, campaign, heath } from "../../../../test/scenarios/the-withered-heath/scene.ts";
import { nextPartId, nextPartStatus } from "../../../../test/harness/next-part.ts";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { checklist } from "../../checklist.ts";
import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS, poolEncounterCopies, wilderlandFacts } from "../../wilderland.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

let ctx: ReduceContext;
let cards: Awaited<ReturnType<typeof heathWorld>>["cards"];
beforeAll(async () => {
  const world = await heathWorld("strong");
  ctx = world.ctx;
  cards = world.cards;
}, 240_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

function opened(start: ReturnType<typeof heathStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

const golden = (name: string) => HEATH_GOLDENS.find((item) => item.name.startsWith(name))!;

// Each test deals a game or two from the earlier parts' logs; under a loaded run they pass 5 s, so the file gives them a minute (phase 53 and 54 did the same for their campaign tests).
describe("The Withered Heath in the ered-mithrin campaign", { timeout: 60_000 }, () => {
  it("is part 4 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(heath.id)).toBe(3);
    expect(heath.campaignCard).toBe(CODES.campaignCard);
    expect(campaign.scenarios[2]).toBe("the-kings-quest");
    expect(campaign.scenarios[4]).toBe("roam-across-rhovanion");
  });

  it("is playable, and the path offers it after the first three parts and Roam Across Rhovanion after it", () => {
    expect(PLAYABLE_SCENARIOS).toContain(heath.id);
    const fresh = campaignPath(campaign, {}, newSave("heath", campaign.id, 1).log);
    expect(fresh[3]).toMatchObject({ id: heath.id, status: expect.not.stringMatching(/completed/) });
    const path = campaignPath(campaign, {}, afterKingsquest(2));
    expect(path.slice(0, 5).map((node) => node.status)).toEqual(["completed", "completed", "completed", "current", expect.not.stringMatching(/completed|current/)]);
  });

  it("deals the Campaign Setup from a blank log: the campaign card on the table, the four Accolade boons set aside, and no ally or removal to ask", () => {
    const plan = heathPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.removedFromEncounter).toEqual([]);
    expect(plan.removedFromCaves).toEqual([]);
    const state = opened(heathStart(1, 1, "Normal"));
    expect(where(state, CODES.campaignCard)[0]).toMatchObject({ zone: "campaign" });
    for (const code of [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer]) expect(where(state, code)[0], code).toMatchObject({ zone: "setAside" });
    expect((state.piles?.cavesDeck ?? [])).toHaveLength(8);
  });

  it("hands the earlier parts' Resolutions to the game (the allies, Abandoned Ruin and the burden in the pool, the pooled encounter cards, the treasures), through the Campaign Setup Checklist", () => {
    const log = rawEarlier(2);
    expect(log.completed).toEqual(["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest"]);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([CODES.turayn, CODES.melanwar, CODES.isolde, CODES.abandonedRuin, CODES.theThreatToWilderland]));
    expect(log.allyLines ?? []).toEqual([]);
    expect(log.treasures?.length).toBe(3);
    expect(poolEncounterCopies(log.encounterPool ?? {})).toContain("01095");
    // The checklist reads the same log as the game does.
    const facts = wilderlandFacts(log, campaign.id);
    expect(facts.treasures).toEqual(log.treasures);
    expect(facts.encounterPool).toEqual(log.encounterPool);
    const given = afterKingsquest(2);
    const answers = heathSetupChoices(2, given, "Normal");
    const state = opened(heathStart(2, 3, "Normal", undefined, given, undefined, answers));
    expect(state.campaignFacts?.treasures).toEqual(given.treasures);
    expect(state.campaignFacts?.encounterPool).toEqual(given.encounterPool);
    // The pool's encounter cards are dealt with this scenario's own copies; Abandoned Ruin waits in the Caves deck; The Threat to Wilderland enters the staging area at its Setup.
    const base = opened(heathStart(2, 3, "Normal", undefined, emptyLog(2), undefined, []));
    for (const [code, copies] of Object.entries(given.encounterPool ?? {})) expect(where(state, code), code).toHaveLength(where(base, code).length + copies);
    expect(codesOf(state, state.piles?.cavesDeck ?? [])).toContain(CODES.abandonedRuin);
    expect(where(state, CODES.theThreatToWilderland)).toHaveLength(1);
    // The treasures discovered are out of the draw the Resolution makes.
    const left = undiscoveredTreasures(state, ctx);
    for (const code of given.treasures ?? []) expect(left, code).not.toContain(code);
    expect(left.length).toBe(TREASURES.length - (given.treasures?.length ?? 0));
  });

  it("asks the first player for the boon ally search (12175:A:2): the pool's allies are offered, the one taken goes to the hand after the mulligan, and a skip takes none", () => {
    const given = afterKingsquest(2);
    // Without an answer the checklist stops at the first seat's offer: Turayn, Melanwar and Isolde, or skip.
    expect(() => heathPlan(2, given)).toThrow();
    const asks = checklist({ log: given, scenario: campaignScenario(heath), seats: heathLoadout(2), effects: EFFECTS, cards });
    expect(!asks.ok && asks.needs).toMatchObject({ seat: 0, options: expect.arrayContaining([CODES.turayn, CODES.melanwar, CODES.isolde, "skip"]) });
    expect(!asks.ok && asks.needs?.note).toBe("Search your deck for a unique boon ally to add to your hand, or skip. It joins your hand after the mulligan, and if you take one no other player does.");
    const taken = [CODES.melanwar];
    const state = opened(heathStart(2, 3, "Normal", undefined, given, undefined, taken));
    const mine = state.seats[0]!;
    expect(codesOf(state, mine.hand)).toContain(CODES.melanwar);
    expect(codesOf(state, mine.deck)).not.toContain(CODES.melanwar);
    // The other two pool allies were shuffled into the deck as before: nobody else takes one.
    for (const code of [CODES.turayn, CODES.isolde]) expect(where(state, code), code).toHaveLength(1);
    expect(where(state, CODES.melanwar)).toHaveLength(1);
    const skipped = opened(heathStart(2, 3, "Normal", undefined, given, undefined, ["skip"]));
    expect(where(skipped, CODES.melanwar)[0]?.zone).not.toBe("setAside");
    expect(where(skipped, CODES.melanwar)).toHaveLength(1);
    // The first player is asked first; once one takes an ally the offer ends (a second seat's answer would be refused).
    expect(() => heathPlan(2, given, [CODES.turayn, CODES.melanwar])).not.toThrow();
  });

  it("removes cards with the lines (Melanwar's: 2 non-unique locations and 1 location of the scenario's own Caves deck; Isolde's: 3 non-unique enemies), and a pooled Abandoned Ruin joins the Caves deck after and cannot be removed (user ruling, 2026-11-05)", () => {
    for (const [variant, seats, isolde] of [["oath", 1, false], ["oathline", 1, true], ["oath", 2, true]] as const) {
      const log = afterKingsquest(seats, variant);
      expect(log.allyLines, `${seats} ${variant}`).toContain("melanwar");
      expect(log.campaignPool.map((card) => card.code), `${seats} ${variant}`).toContain(CODES.abandonedRuin);
      const answers = heathSetupChoices(seats, log, "Normal");
      const plan = heathPlan(seats, log, answers);
      const removedTypes = plan.removedFromEncounter.map((code) => cards.get(code)?.type);
      expect(removedTypes.filter((type) => type === "location"), `${seats} ${variant}`).toHaveLength(2);
      expect(removedTypes.filter((type) => type === "enemy"), `${seats} ${variant}`).toHaveLength(isolde ? 3 : 0);
      // The Caves deck the scenario deals: its own six cards, never the pooled Abandoned Ruin.
      expect(plan.removedFromCaves, `${seats} ${variant}`).toHaveLength(1);
      expect(plan.removedFromCaves, `${seats} ${variant}`).not.toContain(CODES.abandonedRuin);
      const state = opened(heathStart(seats, 2, "Normal", undefined, log, undefined, answers));
      const caves = codesOf(state, state.piles?.cavesDeck ?? []);
      expect(caves, `${seats} ${variant}`).toContain(CODES.abandonedRuin);
      expect(caves, `${seats} ${variant}`).toHaveLength(6 + 2 + 1 - 1);
      expect(where(state, plan.removedFromCaves[0] ?? ""), `${seats} ${variant}`).toEqual([]);
    }
  });

  it("deals the original game in a standalone game: no campaign card, no Accolade boons set aside, no pool and no ally search", () => {
    const start = buildStart({ campaign, scenario: heath, seatCount: 1, seed: 1, threatModifier: 0, seats: heathLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    for (const code of [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer, CODES.abandonedRuin, CODES.theThreatToWilderland]) expect(where(state, code), code).toEqual([]);
    expect(state.piles?.cavesDeck?.length).toBeGreaterThan(0);
  });

  it("writes its Accolade boons, Songs and treasure to the log when won, unlocks Roam Across Rhovanion (coming soon), and writes nothing when lost", async () => {
    // Two-handed, after the earlier parts: each player's Accolade boon joins the pool on its hero, each Song joins the pool, the treasure chosen is added to the ones discovered.
    const win = golden("two-handed, won, after the earlier parts, an Accolade boon for each player");
    const state = goldenState("the-withered-heath", win.name);
    const before = logBeforeGolden(win);
    const log = applyResolution(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual([...before.completed, heath.id]);
    expect(log.completed).toHaveLength(4);
    const pooled = log.campaignPool.map((card) => card.code);
    expect(pooled).toEqual(expect.arrayContaining([CODES.turayn, CODES.melanwar, CODES.isolde, CODES.abandonedRuin, CODES.masterOfTheHunt, CODES.unbroken, CODES.theCannyHuntsman, CODES.aTaleOfVictories]));
    // An Accolade boon is added on its hero; a Song is added to the pool of its player.
    for (const code of [CODES.masterOfTheHunt, CODES.unbroken]) expect(log.campaignPool.find((card) => card.code === code)?.attachedTo, code).not.toBeNull();
    for (const code of [CODES.theCannyHuntsman, CODES.aTaleOfVictories]) expect(log.campaignPool.find((card) => card.code === code)?.attachedTo ?? null, code).toBeNull();
    expect(log.treasures).toEqual([...(before.treasures ?? []), ...(state.resolutionLog.treasures ?? [])]);
    expect(log.treasures?.length).toBe((before.treasures?.length ?? 0) + (state.resolutionLog.treasures?.length ?? 0));
    expect(state.resolutionLog.treasures?.length).toBeGreaterThan(0);
    // The path now offers the fifth part next, which the app cannot deal yet.
    const path = campaignPath(campaign, {}, log);
    expect(path.slice(0, 5).map((node) => [node.id, node.status === "completed"])).toEqual([["journey-up-the-anduin", true], ["lost-in-mirkwood", true], ["the-kings-quest", true], [heath.id, true], [nextPartId(campaign, heath.id), false]]);
    expect(path[4]?.status).toBe(nextPartStatus(campaign, heath.id));
    expect(nextStep(path, null)).toMatchObject({ node: { id: "roam-across-rhovanion" } });
    // The lines written by the earlier parts stay on the log; nothing this part writes removes them.
    const lined = golden("two-handed, Easy, won, Melanwar's and Isolde's lines");
    const lineState = goldenState("the-withered-heath", lined.name);
    const written = applyResolution(logBeforeGolden(lined), lineState.scenarioId, lineState, cards, NO_COPY_LIMITS);
    expect(written.allyLines).toEqual(expect.arrayContaining(["turayn", "melanwar", "isolde"]));
    expect(written.completed).toHaveLength(4);
    // A loss writes nothing.
    const lostGolden = HEATH_GOLDENS.find((item) => item.outcome === "lost")!;
    const weak = await heathWorld(lostGolden.decks);
    const lost = goldenState("the-withered-heath", lostGolden.name);
    expect(lost.lost).toBe(true);
    const blank = emptyLog(lostGolden.seatCount);
    expect(applyResolution(blank, lost.scenarioId, lost, weak.cards, NO_COPY_LIMITS)).toBe(blank);
  }, 180_000);
});

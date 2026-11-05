// Rules: emce.setup-the-kings-quest, emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, emce.haldan, emce.caves-deck, mec109.campaign-mode, ltp.campaign-setup-checklist, rr.campaign-setup-checklist (data/rules/entries.json).
// The King's Quest in the Ered Mithrin campaign: it is the third part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. The two earlier parts' real Resolutions (Journey Up the Anduin's and Lost in
// Mirkwood's golden wins, applied one after the other to a blank log) are what reaches it: Turayn and Melanwar in a player's pool or their lines, A Growing Threat and the encounter cards set aside in the pool, and the treasures discovered, all through the
// Campaign Setup Checklist. Winning this part runs its Resolution and unlocks The Withered Heath (coming soon); a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { undiscoveredTreasures } from "../../../rules/families/wilderland/treasure.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { KINGSQUEST_GOLDENS, afterEarlier, kingsquestLoadout, kingsquestPlan, kingsquestStart, kingsquestWorld, oathChoices, playGolden, rawEarlier } from "../../../../test/scenarios/the-kings-quest/game.ts";
import { CODES, TREASURES, campaign, kingsquest } from "../../../../test/scenarios/the-kings-quest/scene.ts";
import { nextPartId, nextPartStatus } from "../../../../test/harness/next-part.ts";

import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS, poolEncounterCopies, wilderlandFacts } from "../../wilderland.ts";

let ctx: ReduceContext;
let cards: Awaited<ReturnType<typeof kingsquestWorld>>["cards"];
beforeAll(async () => {
  const world = await kingsquestWorld("strong");
  ctx = world.ctx;
  cards = world.cards;
}, 180_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

function opened(start: ReturnType<typeof kingsquestStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

const golden = (name: string) => KINGSQUEST_GOLDENS.find((item) => item.name.startsWith(name))!;

// Each test deals a game or two from the earlier parts' logs; under a loaded run they pass 5 s, so the file gives them a minute (phase 53 did the same for its campaign test).
describe("The King's Quest in the ered-mithrin campaign", { timeout: 60_000 }, () => {
  it("is part 3 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(kingsquest.id)).toBe(2);
    expect(kingsquest.campaignCard).toBe(CODES.campaignCard);
    expect(campaign.scenarios[3]).toBe("the-withered-heath");
  });

  it("is playable, and the path offers it after Journey Up the Anduin and Lost in Mirkwood and The Withered Heath is not yet", () => {
    expect(PLAYABLE_SCENARIOS).toContain(kingsquest.id);
    expect(PLAYABLE_SCENARIOS).not.toContain("the-withered-heath");
    const fresh = campaignPath(campaign, {}, newSave("kings", campaign.id, 1).log);
    expect(fresh[2]).toMatchObject({ id: kingsquest.id, status: expect.not.stringMatching(/completed/) });
    const path = campaignPath(campaign, {}, afterEarlier(2));
    expect(path.slice(0, 4).map((node) => node.status)).toEqual(["completed", "completed", "current", expect.not.stringMatching(/completed|current/)]);
  });

  it("deals the Campaign Setup from a blank log: Isolde in play, The Threat to Wilderland with 3 resources, Dagnir's Spawn in the encounter deck and Abandoned Ruin in the Caves deck, with the checklist's plan", () => {
    const plan = kingsquestPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    const state = opened(kingsquestStart(1, 1, "Normal"));
    expect(where(state, CODES.isolde)[0]).toMatchObject({ zone: "play", controller: state.firstPlayer });
    expect(where(state, CODES.theThreatToWilderland)[0]).toMatchObject({ zone: "staging", resources: 3 });
    expect([...state.encounterDeck, ...state.staging].map((id) => state.cards[id]?.code)).toContain(CODES.dagnirSSpawn);
    expect((state.piles?.cavesDeck ?? []).map((id) => state.cards[id]?.code)).toContain(CODES.abandonedRuin);
  });

  it("hands the earlier parts' Resolutions to the game (Turayn and Melanwar in the pool, the Orcs card part 2 pooled and both treasures discovered), through the Campaign Setup Checklist", () => {
    const log = rawEarlier(2);
    expect(log.completed).toEqual(["journey-up-the-anduin", "lost-in-mirkwood"]);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining(["12166", "12169"]));
    expect(log.allyLines ?? []).toEqual([]);
    // A Growing Threat was dealt and used up in part 2; the Dol Guldur Orcs card its Resolution discarded until found is in the pool.
    expect(log.encounterPool?.["12167"]).toBeUndefined();
    expect(log.encounterPool?.["01089"]).toBe(1);
    expect(log.treasures).toHaveLength(2);
    // The checklist reads the same log as the game does.
    const facts = wilderlandFacts(log, campaign.id);
    expect(facts.treasures).toEqual(log.treasures);
    expect(facts.encounterPool).toEqual(log.encounterPool);
    expect(poolEncounterCopies(log.encounterPool ?? {})).toContain("01089");
    const given = afterEarlier(2);
    const state = opened(kingsquestStart(2, 3, "Normal", undefined, given));
    expect(state.campaignFacts?.treasures).toEqual(given.treasures);
    expect(state.campaignFacts?.encounterPool).toEqual(given.encounterPool);
    // The allies are in their players' decks (Turayn and Melanwar went to the first seat's pool); the pool's card is dealt with this scenario's own copies of the encounter cards.
    for (const code of ["12166", "12169"]) {
      expect(where(state, code), code).toHaveLength(1);
      expect(where(state, code)[0]?.owner ?? where(state, code)[0]?.controller, code).toBe(0);
    }
    const base = opened(kingsquestStart(2, 3, "Normal"));
    for (const [code, copies] of Object.entries(given.encounterPool ?? {})) {
      expect(where(state, code), code).toHaveLength(where(base, code).length + copies);
    }
    // The treasures discovered are out of the draw Abandoned Ruin and the other cards make.
    const left = undiscoveredTreasures(state, ctx);
    for (const code of given.treasures ?? []) expect(left, code).not.toContain(code);
    expect(left.length).toBe(TREASURES.length - (given.treasures?.length ?? 0));
  });

  it("hands the lines instead of the allies when the earlier parts wrote them, and Turayn's oath removes 3 treacheries (the first player naming each)", () => {
    const log = rawEarlier(2, true);
    expect(log.allyLines).toEqual(expect.arrayContaining(["turayn", "melanwar"]));
    expect(log.campaignPool.map((card) => card.code)).not.toEqual(expect.arrayContaining(["12166"]));
    const given = afterEarlier(2, true);
    // Without the answers the checklist stops at the first treachery it must name.
    const asked = kingsquestPlan.bind(null, 2, given);
    expect(() => asked()).toThrow();
    const plan = kingsquestPlan(2, given, oathChoices(ctx));
    expect(plan.removedFromEncounter).toHaveLength(3);
    const state = opened(kingsquestStart(2, 3, "Easy", undefined, given, undefined, oathChoices(ctx)));
    expect(state.campaignFacts?.allyLines).toEqual(expect.arrayContaining(["turayn", "melanwar"]));
    expect(where(state, "12166")).toEqual([]);
    expect(where(state, "12169")).toEqual([]);
    const treacheries = (made: ScenarioState) => Object.values(made.cards).filter((card) => cards.get(card.code)?.type === "treachery").length;
    const dealt = (line: CampaignLog) => treacheries(startScenario(kingsquestStart(2, 3, "Easy", undefined, line, undefined, line.allyLines?.includes("turayn") ? oathChoices(ctx) : undefined), ctx));
    expect(dealt({ ...given, allyLines: (given.allyLines ?? []).filter((line) => line !== "turayn") }) - dealt(given)).toBe(3);
  });

  it("deals the original game in a standalone game: no campaign card, no Isolde, no The Threat to Wilderland, no Dagnir's Spawn, no Abandoned Ruin and no pool", () => {
    const start = buildStart({ campaign, scenario: kingsquest, seatCount: 1, seed: 1, threatModifier: 0, seats: kingsquestLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    for (const code of [CODES.isolde, CODES.theThreatToWilderland, CODES.dagnirSSpawn, CODES.abandonedRuin]) expect(where(state, code), code).toEqual([]);
    expect(state.piles?.cavesDeck?.length).toBeGreaterThan(0);
  });

  it("hands its pool, treasure and log lines to the next part when won, unlocks The Withered Heath (coming soon), and writes nothing when lost", async () => {
    // Two-handed, after the earlier parts: Isolde, Abandoned Ruin and The Threat to Wilderland join the pool next to Turayn and Melanwar, and the treasure is added to the ones discovered.
    const win = golden("two-handed, won, after the earlier parts, a treasure discovered");
    const state = playGolden(win, ctx).state;
    const before = afterEarlier(2);
    const log = applyResolution(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual(["journey-up-the-anduin", "lost-in-mirkwood", kingsquest.id]);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining(["12166", "12169", CODES.isolde]));
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([CODES.abandonedRuin, CODES.theThreatToWilderland]));
    expect(log.campaignPool.map((card) => card.code)).not.toContain(CODES.dagnirSSpawn);
    expect(log.treasures).toEqual([...(before.treasures ?? []), ...(state.resolutionLog.treasures ?? [])]);
    expect(log.treasures?.length).toBe((before.treasures?.length ?? 0) + 1);
    // What The Withered Heath is handed: the log's columns as the game reads them.
    const facts = wilderlandFacts(log, campaign.id);
    expect(facts.treasures).toEqual(log.treasures);
    // The path now offers the fourth part next: it is not yet playable, so it is coming soon.
    const path = campaignPath(campaign, {}, log);
    expect(path.slice(0, 4).map((node) => [node.id, node.status === "completed"])).toEqual([["journey-up-the-anduin", true], ["lost-in-mirkwood", true], [kingsquest.id, true], [nextPartId(campaign, kingsquest.id), false]]);
    expect(path[3]?.status).toBe(nextPartStatus(campaign, kingsquest.id));
    expect(path[3]?.status).toBe("soon");
    const step = nextStep(path, null);
    expect(step).toMatchObject({ kind: "soon", node: { id: "the-withered-heath" } });
    // The lines instead of the allies: Isolde's line is written, and Dagnir's Spawn joins the pool.
    const lined = golden("two-handed, Easy, won, Turayn's oath");
    const lineState = playGolden(lined, ctx).state;
    const written = applyResolution(afterEarlier(2, true), lineState.scenarioId, lineState, cards, NO_COPY_LIMITS);
    expect(written.allyLines).toEqual(expect.arrayContaining(["turayn", "melanwar", "isolde"]));
    expect(written.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([CODES.abandonedRuin, CODES.dagnirSSpawn]));
    expect(written.campaignPool.map((card) => card.code)).not.toContain(CODES.isolde);
    // A loss writes nothing.
    const lostGolden = KINGSQUEST_GOLDENS.find((item) => item.outcome === "lost")!;
    const weak = await kingsquestWorld(lostGolden.decks);
    const lost = playGolden(lostGolden, weak.ctx).state;
    expect(lost.lost).toBe(true);
    const blank = emptyLog(lostGolden.seatCount);
    expect(applyResolution(blank, lost.scenarioId, lost, weak.cards, NO_COPY_LIMITS)).toBe(blank);
  }, 120_000);
});

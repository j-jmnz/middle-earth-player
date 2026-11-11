// Rules: emce.setup-lost-in-mirkwood, emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, emce.haldan, mec109.campaign-mode, ltp.campaign-setup-checklist, rr.campaign-setup-checklist (data/rules/entries.json).
// Lost in Mirkwood in the Ered Mithrin campaign: it is the second part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. The previous part's real Resolution (Journey Up the Anduin's
// golden wins, applied to a blank log) is what reaches it: Turayn in a player's pool or the oath line, A Growing Threat and the encounter cards set aside in the pool, and the treasures discovered. Winning this part runs its Resolution and
// unlocks The King's Quest; a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { UPANDUIN_GOLDENS, upanduinWorld } from "../../../../test/scenarios/journey-up-the-anduin/game.ts";
import { LOSTMIRK_GOLDENS, afterUpanduin, lostmirkLoadout, lostmirkPlan, lostmirkStart, lostmirkWorld, playGolden } from "../../../../test/scenarios/lost-in-mirkwood/game.ts";
import { CODES, TREASURES, campaign, lostmirk } from "../../../../test/scenarios/lost-in-mirkwood/scene.ts";

import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS, poolEncounterCopies, wilderlandFacts } from "../../wilderland.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

let ctx: ReduceContext;
let upanduinCards: Awaited<ReturnType<typeof upanduinWorld>>;
beforeAll(async () => {
  ctx = (await lostmirkWorld("strong")).ctx;
  upanduinCards = await upanduinWorld("strong");
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

function opened(start: ReturnType<typeof lostmirkStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// The log Journey Up the Anduin's real Resolution writes for one of its golden wins, onto a blank log.
function afterJourney(name: string): CampaignLog {
  const golden = UPANDUIN_GOLDENS.find((item) => item.name.startsWith(name))!;
  const state = goldenState("journey-up-the-anduin", golden.name);
  return applyResolution(emptyLog(golden.seatCount), state.scenarioId, state, upanduinCards.cards, NO_COPY_LIMITS);
}

describe("Lost in Mirkwood in the ered-mithrin campaign", () => {
  it("is part 2 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(lostmirk.id)).toBe(1);
    expect(lostmirk.campaignCard).toBe(CODES.campaignCard);
    expect(campaign.scenarios[2]).toBe("the-kings-quest");
  });

  it("is playable, and the path offers it after Journey Up the Anduin and The King's Quest is not yet", () => {
    expect(PLAYABLE_SCENARIOS).toContain(lostmirk.id);
    const fresh = campaignPath(campaign, {}, newSave("mirkwood", campaign.id, 1).log);
    expect(fresh[1]).toMatchObject({ id: lostmirk.id, status: expect.not.stringMatching(/completed/) });
    const won = campaignPath(campaign, {}, afterJourney("two-handed, won, a treasure discovered"));
    expect(won.slice(0, 3).map((node) => node.status)).toEqual(["completed", "current", expect.not.stringMatching(/completed|current/)]);
  });

  it("deals the Campaign Setup from a blank log: Melanwar and Haldan in play, Searching for a Way Out and the Forest Spiders in the staging area, the Spiders and Orcs sets in their piles, with the checklist's plan", () => {
    const plan = lostmirkPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    const state = opened(lostmirkStart(1, 1, "Normal"));
    expect(where(state, CODES.melanwar)[0]).toMatchObject({ zone: "play", controller: state.firstPlayer });
    expect(where(state, CODES.haldan)[0]).toMatchObject({ zone: "play", controller: state.firstPlayer });
    expect(where(state, CODES.searchingForAWayOut)[0]?.zone).toBe("staging");
    expect(where(state, CODES.forestSpider).filter((card) => card.zone === "staging")).toHaveLength(1);
    expect(state.piles?.spidersDeck?.length).toBeGreaterThan(0);
    expect(state.piles?.orcsDeck?.length).toBeGreaterThan(0);
  });

  it("hands Journey Up the Anduin's Resolution to the game: Turayn in the pool, A Growing Threat and the pool's enemies in the encounter deck, and the discovered treasure out of the draw", () => {
    const log = afterJourney("two-handed, won, a treasure discovered");
    expect(log.completed).toEqual(["journey-up-the-anduin"]);
    expect(log.campaignPool.map((card) => card.code)).toContain("12166");
    expect(log.encounterPool?.["12167"]).toBe(1);
    expect(log.treasures).toHaveLength(1);
    // The pool's cards beside A Growing Threat: the cards that were set aside and the enemies of the Evil Creatures deck that the first part left (the log tallies copies).
    const others = Object.entries(log.encounterPool ?? {}).filter(([code]) => code !== "12167");
    expect(others.length).toBeGreaterThan(0);
    // The checklist reads the same log as the game does.
    const facts = wilderlandFacts(log, campaign.id);
    expect(facts.treasures).toEqual(log.treasures);
    expect(facts.encounterPool).toEqual(log.encounterPool);
    expect(poolEncounterCopies(log.encounterPool ?? {})).toContain("12167");
    const state = opened(lostmirkStart(2, 3, "Normal", undefined, log));
    expect(state.campaignFacts?.treasures).toEqual(log.treasures);
    expect(state.campaignFacts?.encounterPool).toEqual(log.encounterPool);
    expect(where(state, "12166")[0]?.owner ?? where(state, "12166")[0]?.controller).toBe(0);
    expect(where(state, "12167")).toHaveLength(1);
    // Each pool card is dealt with this scenario's own copies of the cards (the pool's copy is one more than the data deals, A Growing Threat one it does not deal).
    const base = opened(lostmirkStart(2, 3, "Normal"));
    for (const [code, copies] of others) {
      const dealtBefore = where(base, code).length;
      expect(where(state, code), code).toHaveLength(dealtBefore + copies);
    }
    // The discovered treasure is not drawn for Twilight Hall: the one that guards is another.
    const guarded = where(state, CODES.twilightHall).filter((card) => card.zone === "staging").flatMap((card) => (card.host ? [state.cards[card.host]?.code] : []));
    for (const code of guarded) expect(log.treasures).not.toContain(code);
  });

  it("hands the oath line instead of Turayn to the game when the first part wrote it", () => {
    const log = afterJourney("two-handed, Easy, won, a treasure discovered, the oath line");
    expect(log.allyLines).toEqual(["turayn"]);
    expect(log.campaignPool.map((card) => card.code)).not.toContain("12166");
    const state = opened(lostmirkStart(2, 3, "Easy", undefined, log));
    expect(state.campaignFacts?.allyLines).toEqual(["turayn"]);
    expect(where(state, "12166")).toEqual([]);
  });

  it("deals the checklist from the earlier parts' log (afterUpanduin): Turayn from the pool, and no treasure discovered yet", () => {
    const log = afterUpanduin(1);
    expect(log.completed).toEqual(["journey-up-the-anduin"]);
    const state = opened(lostmirkStart(1, 2, "Normal", undefined, log));
    expect(where(state, "12166")).toHaveLength(1);
    expect(state.campaignFacts?.treasures ?? []).toEqual([]);
  });

  it("deals the original game in a standalone game: no campaign card, no Melanwar, no Twilight Hall treasure, and no pool", () => {
    const start = buildStart({ campaign, scenario: lostmirk, seatCount: 1, seed: 1, threatModifier: 0, seats: lostmirkLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    expect(where(state, CODES.melanwar)).toEqual([]);
    expect(Object.values(state.cards).filter((card) => (TREASURES as readonly string[]).includes(card.code))).toEqual([]);
  });

  it("hands its pool, treasure and log line to the next part when won, unlocks The King's Quest, and writes nothing when lost", async () => {
    const world = await lostmirkWorld("strong");
    const played = (name: string) => playGolden(LOSTMIRK_GOLDENS.find((item) => item.name.startsWith(name))!, world.ctx).state;
    // Two-handed, Melanwar joins the pool: the log holds the treasure, the Spiders / Orcs card and Melanwar in a player's pool.
    const first = played("two-handed, won, Melanwar joins the pool");
    const log = applyResolution(afterJourney("two-handed, won, a treasure discovered"), first.scenarioId, first, world.cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual(["journey-up-the-anduin", lostmirk.id]);
    expect(log.treasures).toEqual(expect.arrayContaining([...(first.resolutionLog.treasures ?? [])]));
    expect(log.treasures).toHaveLength(2);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining(["12166", CODES.melanwar]));
    for (const [code, copies] of Object.entries(first.resolutionLog.encounterPool ?? {})) expect(log.encounterPool?.[code], code).toBeGreaterThanOrEqual(copies);
    // What The King's Quest is handed: the log's columns as the game reads them.
    const facts = wilderlandFacts(log, campaign.id);
    expect(facts.treasures).toEqual(log.treasures);
    expect(facts.encounterPool).toEqual(log.encounterPool);
    // The path now offers The King's Quest next (it is not yet playable, so it is coming soon).
    const path = campaignPath(campaign, {}, log);
    expect(path.slice(0, 3).map((node) => [node.id, node.status === "completed"])).toEqual([["journey-up-the-anduin", true], [lostmirk.id, true], ["the-kings-quest", false]]);
    // The guidance line instead of the ally: The King's Quest reads the line, and Melanwar is not in the pool.
    const line = played("two-handed, Easy, won, the guidance line");
    const lined = applyResolution(emptyLog(2), line.scenarioId, line, world.cards, NO_COPY_LIMITS);
    expect(lined.allyLines).toEqual(["melanwar"]);
    expect(lined.campaignPool.map((card) => card.code)).not.toContain(CODES.melanwar);
    expect(wilderlandFacts(lined, campaign.id).allyLines).toEqual(["melanwar"]);
    // A loss writes nothing.
    const lostGolden = LOSTMIRK_GOLDENS.find((item) => item.outcome === "lost")!;
    const weak = await lostmirkWorld(lostGolden.decks);
    const lost = goldenState("lost-in-mirkwood", lostGolden.name);
    const blank = emptyLog(lostGolden.seatCount);
    expect(applyResolution(blank, lost.scenarioId, lost, weak.cards, NO_COPY_LIMITS)).toBe(blank);
  }, 60_000);
});

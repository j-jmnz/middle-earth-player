// Rules: emce.setup-journey-up-the-anduin, emce.campaign-pool-encounter, emce.treasure, emce.boon-allies, mec109.campaign-mode, ltp.campaign-setup-checklist, rr.campaign-setup-checklist (data/rules/entries.json).
// Journey Up the Anduin in the Ered Mithrin campaign: it is the first part, its campaign card names the Setup the campaign deals, and a standalone game plays the scenario with none of it. As the first part it has no earlier
// Resolution to chain from: the campaign start (a blank log) is what reaches it, and what a later play of the part would be handed (the pool's encounter cards, the treasures discovered) is dealt as the log says.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { UPANDUIN_GOLDENS, playGolden, upanduinLoadout, upanduinPlan, upanduinStart, upanduinWorld } from "../../../../test/scenarios/journey-up-the-anduin/game.ts";
import { CODES, TREASURES, campaign, upanduin } from "../../../../test/scenarios/journey-up-the-anduin/scene.ts";

import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS, poolEncounterCopies, wilderlandFacts } from "../../wilderland.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  ctx = (await upanduinWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

function opened(start: ReturnType<typeof upanduinStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("Journey Up the Anduin in the ered-mithrin campaign", () => {
  it("is part 1 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(upanduin.id)).toBe(0);
    expect(upanduin.campaignCard).toBe(CODES.campaignCard);
  });

  it("deals the Campaign Setup: Turayn in play, A Growing Threat in the encounter deck, the Old Ford and Woodmen Village set aside, with the checklist's plan from a blank log", () => {
    const plan = upanduinPlan(1);
    expect(plan.steps.length).toBeGreaterThan(0);
    const state = opened(upanduinStart(1, 1, "Normal"));
    expect(where(state, CODES.turayn)[0]?.zone).toBe("play");
    expect([...state.encounterDeck, ...state.staging, ...state.encounterDiscard].map((id) => state.cards[id]?.code)).toContain(CODES.aGrowingThreat);
    expect(where(state, CODES.theOldFord)[0]?.zone).toBe("setAside");
    expect(where(state, CODES.woodmenVillage)[0]?.zone).toBe("setAside");
  });

  it("hands the log to the game: a pool card of the encounter deck is dealt with the scenario's own, and a discovered treasure is no longer drawn", () => {
    const log = { ...emptyLog(1), encounterPool: { [CODES.goblinTroop]: 1 }, treasures: [...TREASURES.slice(0, 8)] };
    const state = opened(upanduinStart(1, 1, "Normal", undefined, log));
    // The pool's copy is dealt with the scenario's own Goblin Troops (1 more than the data deals).
    const base = opened(upanduinStart(1, 1, "Normal"));
    const count = (from: ScenarioState) => where(from, CODES.goblinTroop).length;
    expect(count(state)).toBe(count(base) + 1);
    expect(state.campaignFacts?.treasures).toEqual(TREASURES.slice(0, 8));
  });

  it("deals the original game in a standalone game: no campaign card, no Turayn, no A Growing Threat, and no pool", () => {
    const start = buildStart({ campaign, scenario: upanduin, seatCount: 1, seed: 1, threatModifier: 0, seats: upanduinLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = opened(start);
    expect(where(state, CODES.campaignCard)).toEqual([]);
    expect(where(state, CODES.turayn)).toEqual([]);
    expect(where(state, CODES.aGrowingThreat)).toEqual([]);
    expect(state.piles?.evilCreaturesDeck).toHaveLength(8);
  });

  it("is playable, and the path offers it as the current part of a new save", () => {
    expect(PLAYABLE_SCENARIOS).toContain(upanduin.id);
    const nodes = campaignPath(campaign, {}, newSave("anduin", campaign.id, 1).log);
    expect(nodes[0]).toMatchObject({ id: upanduin.id, status: "current" });
    expect(nodes[1]?.status).not.toBe("completed");
  });

  it("hands its pool, treasures and log line to the next part when won, and writes nothing when lost", async () => {
    const cards = (await upanduinWorld("strong")).cards;
    const won = (name: string) => {
      const golden = UPANDUIN_GOLDENS.find((item) => item.name.startsWith(name))!;
      return playGolden(golden, ctx).state;
    };
    // Two-handed, a treasure discovered, Turayn joins the pool: the log holds the treasure, A Growing Threat, the card A Growing Threat set aside and Turayn in a player's pool.
    const first = won("two-handed, won, a treasure discovered");
    const log = applyResolution(emptyLog(2), first.scenarioId, first, cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual([upanduin.id]);
    expect(log.treasures).toEqual(first.resolutionLog.treasures);
    expect(log.treasures).toHaveLength(1);
    expect(log.encounterPool?.["12167"]).toBe(1);
    expect(log.campaignPool.map((card) => card.code)).toContain("12166");
    // What part 2 is handed: the log's columns as the game reads them, and the pool's encounter cards that its deal shuffles in.
    const facts = wilderlandFacts(log, campaign.id);
    expect(facts.treasures).toEqual(log.treasures);
    expect(facts.encounterPool).toEqual(log.encounterPool);
    expect(poolEncounterCopies(log.encounterPool ?? {})).toContain("12167");
    // The oath line instead of the ally: part 2 reads the line, and Turayn is not in the pool.
    const oath = won("two-handed, Easy, won, a treasure discovered, the oath line");
    const lined = applyResolution(emptyLog(2), oath.scenarioId, oath, cards, NO_COPY_LIMITS);
    expect(lined.allyLines).toEqual(["turayn"]);
    expect(lined.campaignPool.map((card) => card.code)).not.toContain("12166");
    expect(wilderlandFacts(lined, campaign.id).allyLines).toEqual(["turayn"]);
    // A loss writes nothing.
    const lostGolden = UPANDUIN_GOLDENS.find((item) => item.outcome === "lost")!;
    const weak = await upanduinWorld("weak");
    const lost = playGolden(lostGolden, weak.ctx).state;
    const blank = emptyLog(lostGolden.seatCount);
    expect(applyResolution(blank, lost.scenarioId, lost, weak.cards, NO_COPY_LIMITS)).toBe(blank);
  });
});

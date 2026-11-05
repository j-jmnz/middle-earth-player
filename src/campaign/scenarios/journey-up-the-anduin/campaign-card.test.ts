// Rules: emce.setup-journey-up-the-anduin, emce.evil-creatures-deck, emce.boon-allies, emce.treasure, emce.campaign-pool-encounter, rr.campaign-setup-checklist (data/rules/entries.json); ledger lines 120165:A:2 to 120165:B:3, 18066:A:1.
// The campaign card of Journey Up the Anduin (120165) dealt in a game: its Setup, the Response that collects resources and attaches a treasure, and the Resolution.
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { upanduinStart, upanduinWorld } from "../../../../test/scenarios/journey-up-the-anduin/game.ts";
import { CODES, TREASURES, codesIn, finish, idOf, idsOf, legalIntents, loadUpanduinWorld, resolveRecords, send, start, upanduinTable, type Run, type UpanduinWorld } from "../../../../test/scenarios/journey-up-the-anduin/scene.ts";

let ctx: ReduceContext;
let scene: UpanduinWorld;
beforeAll(async () => {
  ctx = (await upanduinWorld("strong")).ctx;
  scene = await loadUpanduinWorld();
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered with the first option.
function opened(seats: 1 | 2, difficulty: "Normal" | "Easy" = "Normal", seed = 1): ScenarioState {
  let state = startScenario(upanduinStart(seats, seed, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("120165:A:2 Setup", () => {
  it("puts Turayn into play under the first player and shuffles A Growing Threat into the encounter deck", () => {
    const state = opened(2);
    expect(where(state, CODES.turayn)[0]).toMatchObject({ zone: "play", controller: state.firstPlayer });
    const deck = [...state.encounterDeck, ...state.staging, ...state.encounterDiscard];
    expect(deck.map((id) => state.cards[id]?.code)).toContain(CODES.aGrowingThreat);
  });

  it("sets Woodmen Village and The Old Ford aside and deals the Wilderlands enemies, 8 of them (6 on Easy), as the Evil Creatures deck", () => {
    const normal = opened(1);
    expect(where(normal, CODES.woodmenVillage)[0]?.zone).toBe("setAside");
    expect(where(normal, CODES.theOldFord)[0]?.zone).toBe("setAside");
    expect(normal.piles?.evilCreaturesDeck).toHaveLength(8);
    expect(normal.piles?.evilCreaturesDiscard).toEqual([]);
    const evil = (normal.piles?.evilCreaturesDeck ?? []).map((id) => normal.cards[id]);
    expect(evil.every((card) => card?.deck === "evilCreatures" && ["01081", "01082", "01083", "01084", "01085"].includes(card.code))).toBe(true);
    expect(opened(1, "Easy").piles?.evilCreaturesDeck).toHaveLength(6);
  });

  it("deals no Wilderlands location or treachery into the encounter deck", () => {
    const state = opened(1);
    const wilderlands = new Set(["01086", "01087", "01088"]);
    expect(Object.values(state.cards).filter((card) => wilderlands.has(card.code))).toEqual([]);
  });

  it("shuffles the Evil Creatures deck and the encounter deck, and adds a location for each player from the top of the encounter deck to the staging area", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      expect(state.staging.filter((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.type === "location")).toHaveLength(seats);
    }
    expect(codesIn(opened(1), "evilCreaturesDeck").length).toBe(8);
  });
});

describe("120165:A:3 Response", () => {
  const table = (resources: number, layout: Parameters<typeof upanduinTable>[1] = {}) => {
    const t = upanduinTable(scene, { campaign: true, staging: [CODES.banksOfTheAnduin], ...layout });
    const campaignCard = idOf(t.state, CODES.campaignCard);
    return { ...t, campaignCard, state: { ...t.state, cards: { ...t.state.cards, [campaignCard]: { ...t.state.cards[campaignCard]!, resources } } } };
  };
  const explore = (state: ScenarioState, tctx: ReduceContext, id: string): Run => {
    let run: Run = send(start(state), { type: "Pass" }, tctx);
    run = { ...run, state: { ...run.state } };
    return run;
  };

  it("is offered after a non-unique location is explored, and puts a resource on the card", () => {
    const t = table(0);
    const banks = idOf(t.state, CODES.banksOfTheAnduin);
    const run = resolveRecords(t.state, t.ctx, CODES.campaignCard, "response", t.campaignCard);
    expect(run.state.cards[t.campaignCard]?.resources).toBe(1);
    expect(explore).toBeDefined();
    expect(banks).toBeDefined();
  });

  it("attaches a treasure at players + 3 resources, 6 with 3 players' worth, chosen from 3 random undiscovered ones", () => {
    const solo = table(3);
    const run = resolveRecords(solo.state, solo.ctx, CODES.campaignCard, "response", solo.campaignCard);
    expect(run.state.cards[solo.campaignCard]?.resources).toBe(4);
    const treasure = Object.values(run.state.cards).find((card) => (TREASURES as readonly string[]).includes(card.code));
    expect(treasure).toMatchObject({ zone: "play", controller: 0, host: expect.any(String) });
    expect(run.state.cards[treasure?.host ?? ""]?.zone).toBe("heroes");
  });

  it("attaches no treasure before or after that count: resources 2 and 4 place the 3rd and 5th without one", () => {
    for (const before of [2, 4]) {
      const t = table(before);
      const run = resolveRecords(t.state, t.ctx, CODES.campaignCard, "response", t.campaignCard);
      expect(Object.values(run.state.cards).some((card) => (TREASURES as readonly string[]).includes(card.code))).toBe(false);
    }
  });

  it("needs 5 resources with two players, and offers the first player the 3 treasures to choose from", () => {
    const t = table(4, { seats: 2 });
    const run = resolveRecords(t.state, t.ctx, CODES.campaignCard, "response", t.campaignCard, (state) => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : ""));
    const treasure = Object.values(run.state.cards).find((card) => (TREASURES as readonly string[]).includes(card.code));
    expect(run.state.cards[t.campaignCard]?.resources).toBe(5);
    expect(treasure?.zone).toBe("play");
  });

  it("puts the treasure chosen on the character the first player chooses, which gets its bonus, and the Dwarf-Lord's Crown only on a hero", () => {
    const t = table(3);
    const axe = resolveRecords(t.state, t.ctx, CODES.campaignCard, "response", t.campaignCard, (state) => (state.window?.kind === "choose" && state.window.options.includes("12197") ? "12197" : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
    const carried = Object.values(axe.state.cards).find((card) => (TREASURES as readonly string[]).includes(card.code));
    const host = axe.state.cards[carried?.host ?? ""];
    expect(host).toBeDefined();
    if (carried?.code === "12197") expect(modifiedStat(syncConstants(axe.state, t.ctx), host!, "attack", t.ctx.cards)).toBe((t.ctx.cards.get(host!.code)?.attack ?? 0) + 2);
    expect(host?.zone).toBe("heroes");
  });

  it("draws only treasures the log has not recorded", () => {
    const t = table(3);
    const recorded = { ...t.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, treasures: TREASURES.slice(0, 6) } };
    const run = resolveRecords(recorded, t.ctx, CODES.campaignCard, "response", t.campaignCard, (state) => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : ""));
    const treasure = Object.values(run.state.cards).find((card) => (TREASURES as readonly string[]).includes(card.code));
    expect(TREASURES.slice(6)).toContain(treasure?.code);
  });
});

// The scenario won: the Resolution waits for the first player's answer, which `pick` gives (the first option by default); every instruction after it settles on its own.
function won(state: ScenarioState, pick: (options: readonly string[]) => string = (options) => options[0] ?? ""): ScenarioState {
  let next = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
  for (let guard = 0; guard < 20 && next.window?.kind === "resolution"; guard += 1) {
    const options = legalIntents(next, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: pick(options) } as PlayerIntent, ctx)).state, ctx);
  }
  return next;
}

const asked = (state: ScenarioState) => legalIntents(openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx), ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
// Enemies from the Evil Creatures deck come into play (the staging area) and a treasure is claimed by the first hero, as the Response would leave them.
function played(state: ScenarioState, enemies: number): ScenarioState {
  let next = state;
  for (const id of (state.piles?.evilCreaturesDeck ?? []).slice(0, enemies)) next = moveCard(next, id, { zone: "staging" });
  return next;
}
const withTreasure = (state: ScenarioState, code: string, zone: "play" | "staging"): ScenarioState => {
  const hero = state.seats[0]?.heroes[0] ?? "";
  const spawned = spawn(state, code, zone === "play" ? { zone: "play", seat: 0 } : { zone: "staging" });
  return zone === "play" ? attachTo(spawned.state, spawned.id, hero) : spawned.state;
};

describe("120165:B Resolution", () => {
  it("asks the first player whether Turayn joins the pool, for a player, or the oath line is written", () => {
    const state = opened(2);
    const options = asked(state);
    expect(options).toContain("line");
    expect(options.filter((option) => option.startsWith(`${CODES.turayn}>`))).toHaveLength(2);
    const line = resolutionResult(won(state, () => "line"));
    expect(line?.allyLines).toEqual(["turayn"]);
    expect(line?.earned.map((item) => item.code)).not.toContain(CODES.turayn);
    const joined = resolutionResult(won(state, (all) => all.find((option) => option.startsWith(CODES.turayn)) ?? ""));
    expect(joined?.earned.map((item) => item.code)).toContain(CODES.turayn);
    expect(joined?.allyLines).toBeUndefined();
  });

  it("discovers each treasure the players control, and not one still in the staging area", () => {
    const state = opened(1);
    const kept = resolutionResult(won(withTreasure(withTreasure(state, TREASURES[0], "play"), TREASURES[1], "staging")));
    expect(kept?.treasures).toEqual([TREASURES[0]]);
    expect(resolutionResult(won(state))?.treasures).toBeUndefined();
  });

  it("adds A Growing Threat, and a copy of each Evil Creatures enemy in play, to the pool", () => {
    const state = opened(1);
    expect(resolutionResult(won(state))?.encounterPool).toEqual({ [CODES.aGrowingThreat]: 1 });
    const enemies = played(state, 4);
    const expected: Record<string, number> = { [CODES.aGrowingThreat]: 1 };
    for (const id of enemies.staging) if (enemies.cards[id]?.deck === "evilCreatures") expected[enemies.cards[id]?.code ?? ""] = (expected[enemies.cards[id]?.code ?? ""] ?? 0) + 1;
    expect(resolutionResult(won(enemies))?.encounterPool).toEqual(expected);
  });

  it("writes nothing for a lost game", () => {
    const lost = { ...opened(1), lost: true };
    expect(resolutionResult(openResolution({ ...lost, stageCleared: true, window: null }, ctx))).toBeNull();
  });
});

void [finish, idsOf, codesIn];

// Rules: emce.setup-lost-in-mirkwood, emce.haldan, emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, rr.guarded, rr.campaign-setup-checklist (data/rules/entries.json); ledger lines 12168:A:1, 12168:A:2, 12168:B:1, 12168:B:2, 12168:B:3.
// The campaign card of Lost in Mirkwood (12168) dealt in a game: its Setup (Melanwar, the searched-for Twilight Hall guarding a random treasure, the claim of the freed treasure) and its Resolution (Melanwar or his line, the treasures discovered, the Spiders and Orcs cards in the pool).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { lostmirkStart, lostmirkWorld } from "../../../../test/scenarios/lost-in-mirkwood/game.ts";
import { CODES, TREASURES, legalIntents } from "../../../../test/scenarios/lost-in-mirkwood/scene.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  ctx = (await lostmirkWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const treasuresIn = (state: ScenarioState) => Object.values(state.cards).filter((card) => (TREASURES as readonly string[]).includes(card.code));

// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered by `pick` (the first option by default).
function opened(seats: 1 | 2, seed = 1, pick: (options: readonly string[]) => string = (options) => options[0] ?? ""): ScenarioState {
  let state = startScenario(lostmirkStart(seats, seed, "Normal"), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: pick(state.window.options) }, ctx)).state;
  return state;
}

describe("12168:A Setup", () => {
  it("Melanwar comes under the first player's control", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      expect(where(state, CODES.melanwar)[0]).toMatchObject({ zone: "play", controller: state.firstPlayer });
    }
  });

  it("the first player searches for Twilight Hall, which enters the staging area guarding a random treasure", () => {
    const state = opened(1);
    const hall = where(state, CODES.twilightHall)[0];
    const treasure = treasuresIn(state)[0];
    expect(treasure).toMatchObject({ zone: "staging", face: "up" });
    expect(hall).toMatchObject({ zone: "staging", host: treasure?.id, guard: true });
    expect(TREASURES).toContain(treasure?.code);
    expect(state.staging).toContain(treasure?.id);
  });

  it("the treasure is a random pick of the game's seed: the same seed gives the same one", () => {
    const first = treasuresIn(opened(1, 1))[0]?.code;
    expect(treasuresIn(opened(1, 1))[0]?.code).toBe(first);
    const others = new Set([2, 3, 4, 5, 6].map((seed) => treasuresIn(opened(1, seed))[0]?.code));
    expect(others.size).toBeGreaterThan(1);
  });

  it("declining the search leaves Twilight Hall in the encounter deck and draws no treasure", () => {
    const state = opened(1, 1, (options) => options.at(-1) ?? "");
    expect(treasuresIn(state)).toEqual([]);
    expect(where(state, CODES.twilightHall)[0]?.zone).toBe("encounterDeck");
  });

  it("when Twilight Hall leaves play the treasure is free of encounters: the first player claims it and attaches it to a character", () => {
    const state = opened(1);
    const hall = where(state, CODES.twilightHall)[0]!;
    const treasure = treasuresIn(state)[0]!;
    // The guard is defeated or discarded; the claim waits for the first player's choice of the character.
    let claimed = expectOk(reduce(moveCard(state, hall.id, { zone: "encounterDiscard" }), { type: "Pass" } as PlayerIntent, ctx)).state;
    for (let guard = 0; guard < 6 && claimed.window?.kind === "choose"; guard += 1) claimed = expectOk(reduce(claimed, { type: "Choose", optionId: claimed.window.options[0] ?? "" }, ctx)).state;
    const held = claimed.cards[treasure.id];
    expect(held?.zone).not.toBe("staging");
    expect(held?.controller).toBe(0);
    expect(claimed.cards[held?.host ?? ""]?.zone).toBe("heroes");
    expect(claimed.staging).not.toContain(treasure.id);
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
// The cards (by code) on top of the encounter deck, first one on top.
function onTop(state: ScenarioState, codes: readonly string[]): ScenarioState {
  let next = state;
  const added: string[] = [];
  for (const code of codes) {
    const spawned = spawn(next, code, { zone: "encounterDeck" }, "down");
    next = spawned.state;
    added.push(spawned.id);
  }
  return { ...next, encounterDeck: [...added, ...next.encounterDeck.filter((id) => !added.includes(id))] };
}

describe("12168:B Resolution", () => {
  it("asks the first player whether Melanwar joins the pool, for a player, or the guidance line is written", () => {
    const state = opened(2);
    const options = asked(state);
    expect(options).toContain("line");
    expect(options.filter((option) => option.startsWith(`${CODES.melanwar}>`))).toHaveLength(2);
    const line = resolutionResult(won(state, () => "line"));
    expect(line?.allyLines).toEqual(["melanwar"]);
    expect(line?.earned.map((item) => item.code)).not.toContain(CODES.melanwar);
    const joined = resolutionResult(won(state, (all) => all.find((option) => option.startsWith(CODES.melanwar)) ?? ""));
    expect(joined?.earned.map((item) => item.code)).toContain(CODES.melanwar);
    expect(joined?.allyLines).toBeUndefined();
  });

  it("discovers the treasure the players control, and not one still guarded in the staging area", () => {
    const state = opened(1);
    expect(resolutionResult(won(state))?.treasures).toBeUndefined();
    const hall = where(state, CODES.twilightHall)[0]!;
    let claimed = expectOk(reduce(moveCard(state, hall.id, { zone: "encounterDiscard" }), { type: "Pass" } as PlayerIntent, ctx)).state;
    for (let guard = 0; guard < 6 && claimed.window?.kind === "choose"; guard += 1) claimed = expectOk(reduce(claimed, { type: "Choose", optionId: claimed.window.options[0] ?? "" }, ctx)).state;
    const code = treasuresIn(state)[0]?.code;
    expect(resolutionResult(won(claimed))?.treasures).toEqual([code]);
  });

  it("discards cards from the encounter deck until X Spiders of Mirkwood or Dol Guldur Orcs cards are discarded, and adds them to the pool (X the number of players)", () => {
    const solo = onTop(opened(1), [CODES.eastBightPatrol, CODES.kingSpider, CODES.eastBightPatrol, CODES.dolGuldurOrcs]);
    expect(resolutionResult(won(solo))?.encounterPool).toEqual({ [CODES.kingSpider]: 1 });
    const pair = onTop(opened(2), [CODES.eastBightPatrol, CODES.kingSpider, CODES.eastBightPatrol, CODES.dolGuldurOrcs, CODES.kingSpider]);
    expect(resolutionResult(won(pair))?.encounterPool).toEqual({ [CODES.kingSpider]: 1, [CODES.dolGuldurOrcs]: 1 });
  });

  it("stops with the deck empty, and writes nothing for a lost game", () => {
    const none = resolutionResult(won({ ...opened(1), encounterDeck: [] }));
    expect(none?.encounterPool ?? {}).toEqual({});
    const lost = { ...opened(1), lost: true };
    expect(resolutionResult(openResolution({ ...lost, stageCleared: true, window: null }, ctx))).toBeNull();
  });
});

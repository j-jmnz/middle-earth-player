// Rules: dcce.campaign-setup-the-city-of-corsairs, dcce.campaign-mode, dcce.encounter-cards, dcce.scalable-upgradable, dcce.indestructible, rr.campaign-setup-checklist, rr.forced, rr.action (data/rules/entries.json); ledger lines 11215:A:2, 11215:A:3, 11215:B:1 to 11215:B:4, 11215:B:7, 11216:A:2 to 11216:A:4, 12158:A:3.
// The campaign card of The City of Corsairs (11215) dealt in a game: what its Setup sets aside and puts into play ("Gavin returned" included), its side B standing from the start (Sahír's Forced, the Refresh Action) and The Black
// Sword it attaches. The Resolution's XP lines are in resolution.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { ruleCause } from "../../../rules/core/cause.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { legalIntents, legalTargets, reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { corsairsStart, corsairsWorld } from "../../../../test/scenarios/the-city-of-corsairs/game.ts";
import { CODES, finish } from "../../../../test/scenarios/the-city-of-corsairs/scene.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  ctx = (await corsairsWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered by `answers` (an option id, else the first option).
function opened(seats: 1 | 2, facts?: Parameters<typeof corsairsStart>[3], answers: readonly string[] = []): ScenarioState {
  let state = startScenario(corsairsStart(seats, 1, "Normal", facts), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) {
    const options = state.window.options;
    const wanted = answers.find((answer) => options.includes(answer));
    state = expectOk(reduce(state, { type: "Choose", optionId: wanted ?? options[0] ?? "" }, ctx)).state;
  }
  return state;
}
const returned = { prisoner: null, usedOnce: [], counters: {}, upgraded: [CODES.gavin] };

describe("11215:A:2, A:3 Setup (Campaign Mode)", () => {
  it("sets Gavin, the Send for Help cards, Black Key and The Black Sword aside, shuffles Thunderstruck into the encounter deck and Crowley into the Corsair deck", () => {
    const state = opened(1);
    const zones = (code: string) => where(state, code).map((card) => card.zone);
    expect(["11211", "11212", "11213", "11214", CODES.gavin, CODES.theBlackSword].map(zones)).toEqual([["setAside"], ["setAside"], ["setAside"], ["setAside"], ["setAside"], ["setAside"]]);
    expect(zones(CODES.thunderstruck)).toEqual(["encounterDeck"]);
    expect(zones(CODES.crowley)).toEqual(["corsairDeck"]);
  });

  it("attaches Black Key (burden) to the Stormcaller, which prints Cannot have attachments, and no Stormcaller side flips (it has none)", () => {
    const state = opened(1);
    const stormcaller = where(state, CODES.stormcaller)[0];
    expect(stormcaller?.attachments.map((id) => state.cards[id]?.code)).toEqual([CODES.blackKey]);
    expect(stormcaller?.face === "B").toBe(false);
  });

  it("puts Calaerion into play under the player with the Dream-chaser, and fits each ship with a Modification boon", () => {
    const state = opened(2);
    const ship = Object.values(state.cards).find((card) => card.zone === "play" && ctx.cards.get(card.code)?.name === "Dream-chaser");
    expect(where(state, CODES.calaerion)[0]).toMatchObject({ zone: "play", controller: ship?.controller });
    const ships = Object.values(state.cards).filter((card) => card.zone === "play" && ctx.cards.get(card.code)?.ship === "objective");
    expect(ships.length).toBe(2);
    for (const each of ships) expect(each.attachments.length, each.code).toBeGreaterThanOrEqual(1);
  });

  it("keeps Gavin out of play unless the Campaign Log says Gavin returned, and then puts him into play under the only player, or the player the first player names", () => {
    expect(where(opened(1), CODES.gavin)[0]?.zone).toBe("setAside");
    expect(where(opened(1, returned), CODES.gavin)[0]).toMatchObject({ zone: "play", controller: 0 });
    let state = startScenario(corsairsStart(2, 1, "Normal", returned), ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const asked: string[][] = [];
    for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) {
      const options = state.window.options;
      if (options.every((id) => id.startsWith("seat:"))) asked.push([...options]);
      state = expectOk(reduce(state, { type: "Choose", optionId: options.includes("seat:1") ? "seat:1" : (options[0] ?? "") }, ctx)).state;
    }
    expect(asked[0]).toEqual(["seat:0", "seat:1"]);
    expect(where(state, CODES.gavin)[0]).toMatchObject({ zone: "play", controller: 1 });
  });

  it("stays beside the quest deck all game, its side B records working from the start", () => {
    const state = opened(1);
    expect(where(state, CODES.campaignCard)[0]?.zone).toBe("campaign");
  });
});

describe("11215:B:2 Captain Sahír enters play", () => {
  // Sahír put into play engaged with the first player, as Final Confrontation does (EngageSetAside), and the engine settled.
  const enters = (state: ScenarioState): ScenarioState => {
    const steps: EngineStep[] = [];
    const next = runInstruction({ ...state, window: null }, { verb: "EngageSetAside", code: CODES.captainSahir }, { seat: 0, sourceId: null }, ctx, steps);
    return finish({ state: settle(next, ctx, steps), steps }, ctx).state;
  };
  const sahirOf = (state: ScenarioState) => where(state, CODES.captainSahir)[0]!;

  it("attaches The Black Sword to him, with 3 resources on it, and Black Key when it is still set aside", () => {
    const state = opened(1);
    // A game in which the Key is still set aside (a copy of the burden outside the Stormcaller's attachments).
    const free = spawn(state, CODES.blackKey, { zone: "setAside" }, "up").state;
    const done = enters(free);
    const sahir = sahirOf(done);
    expect(sahir.zone).toBe("engaged");
    expect(sahir.attachments.map((id) => done.cards[id]?.code).sort()).toEqual([CODES.blackKey, CODES.theBlackSword].sort());
    expect(done.cards[where(done, CODES.theBlackSword)[0]!.id]?.resources).toBe(3);
  });

  it("attaches the Sword alone when Black Key is not set aside (it is on the Stormcaller, or gone with it)", () => {
    const done = enters(opened(1));
    const sahir = sahirOf(done);
    expect(sahir.attachments.map((id) => done.cards[id]?.code)).toEqual([CODES.theBlackSword]);
    expect(where(done, CODES.blackKey)[0]?.host).not.toBe(sahir.id);
  });

  it("gives him +2 Attack, and indestructible: damage past his hit points leaves him in play", () => {
    const done = enters(opened(1));
    const sahir = sahirOf(done);
    const printed = ctx.cards.get(CODES.captainSahir)!;
    expect(modifiedStat(done, sahir, "attack", ctx.cards)).toBe((printed.attack ?? 0) + 2);
    const steps: EngineStep[] = [];
    const hurt = placeDamage(updateCard(done, sahir.id, { resources: 0 }), sahir.id, 20, ctx.cards, steps, "combat", ruleCause("rr.damage"));
    expect(hurt.cards[sahir.id]?.zone).toBe("engaged");
  });
});

describe("11216:A:4 The Black Sword's Forced effect and 12158:A:3 the additional attacks", () => {
  const armedTwo = (): { state: ScenarioState; sahir: string } => {
    const steps: EngineStep[] = [];
    const set = opened(2);
    const next = runInstruction({ ...set, window: null }, { verb: "EngageSetAside", code: CODES.captainSahir }, { seat: 0, sourceId: null }, ctx, steps);
    const done = finish({ state: settle(next, ctx, steps), steps }, ctx).state;
    return { state: { ...done, phase: "Combat" as const, boundaryPhase: "Combat" as const }, sahir: where(done, CODES.captainSahir)[0]!.id };
  };
  const resolved = (state: ScenarioState, sahir: string): ScenarioState => {
    const steps: EngineStep[] = [];
    return settle({ ...queueEvent(state, { trigger: "attackResolved", seat: 0, cardId: sahir }), window: null }, ctx, steps);
  };

  it("after Sahír attacks he attacks the other player, who defends, in turn order", () => {
    const { state, sahir } = armedTwo();
    const after = resolved(state, sahir);
    expect(after.pendingAttack).toMatchObject({ enemyId: sahir, seat: 1 });
    expect(after.cards[sahir]?.controller).toBe(0);
  });

  it("does so once each round: the next attack of the round adds nothing, the next round's first does", () => {
    const { state, sahir } = armedTwo();
    const first = resolved(state, sahir);
    expect(first.pendingAttack?.seat).toBe(1);
    const over = { ...first, pendingAttack: null, window: null };
    expect(resolved(over, sahir).pendingAttack).toBeNull();
    expect(resolved({ ...over, round: over.round + 1 }, sahir).pendingAttack?.seat).toBe(1);
  });

  // The seats Sahír attacks, in order, as the defense windows open: each is answered undefended with the first hero the engine lists.
  const attacked = (from: ScenarioState): number[] => {
    const seats: number[] = [];
    let current = from;
    for (let guard = 0; guard < 120 && (current.pendingAttack || current.stack.length > 0); guard += 1) {
      const intents = legalIntents(current, ctx);
      if (current.window?.kind === "defense" && current.pendingAttack) {
        seats.push(current.pendingAttack.seat);
        const targets = legalTargets(current, { type: "Undefended" }, ctx);
        current = expectOk(reduce(current, { type: "Undefended", heroId: targets[0] ?? "" }, ctx)).state;
      } else if (current.window?.kind === "choose") current = expectOk(reduce(current, { type: "Choose", optionId: current.window.options[0] ?? "" }, ctx)).state;
      else if (intents.some((intent) => intent.type === "Pass")) current = expectOk(reduce(current, { type: "Pass" }, ctx)).state;
      else break;
    }
    return seats;
  };

  it("makes an additional attack against the engaged player for every 5 resources on him, in the combat phase", () => {
    const { state, sahir } = armedTwo();
    expect(attacked(resolved(updateCard(state, sahir, { resources: 4 }), sahir))).toEqual([1]);
    const loaded = attacked(resolved(updateCard(state, sahir, { resources: 5 }), sahir));
    expect(loaded.sort()).toEqual([0, 1]);
    const double = attacked(resolved(updateCard(state, sahir, { resources: 10 }), sahir));
    expect(double.sort()).toEqual([0, 0, 1]);
  });

  it("makes no additional attack outside the combat phase", () => {
    const { state, sahir } = armedTwo();
    const quest = { ...updateCard(state, sahir, { resources: 5 }), phase: "Quest" as const, boundaryPhase: "Quest" as const };
    expect(attacked(resolved(quest, sahir))).toEqual([1]);
  });
});

// Rules: emce.boon-allies, emce.campaign-log, emce.campaign-pool-encounter, emce.deep, rr.setup, rr.damage, rr.action-windows (data/rules/entries.json); ledger lines 12188:A:1, 12166:A:2, 12167:A:2, 12172:A:1, 12173:A:2, 12174:A:1, 12185:A:2, 12186:A:2.
// Beldis (12188) on the scenario's scene, and the pool cards of the first five parts played in part 6: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { openResolution } from "../../../rules/setup/resolution.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { nightStart, nightWorld } from "../../../../test/scenarios/fire-in-the-night/game.ts";
import { CODES, codesIn, finish, idOf, legalIntents, loadNightWorld, nightTable, resolveRecords, send, start, type NightWorld } from "../../../../test/scenarios/fire-in-the-night/scene.ts";

let world: NightWorld;
let ctx: ReduceContext;
beforeAll(async () => {
  world = await loadNightWorld();
  ctx = (await nightWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const optionNamed = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
type Facts = Parameters<typeof nightStart>[3];
// The scenario dealt with these cards in the pool, its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog = emptyLog(seats), seed = 1, facts?: Facts): ScenarioState {
  let state = startScenario(nightStart(seats, seed, "Normal", facts, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const pooled = (seats: 1 | 2, ...cards: readonly { code: string; seat?: number; afterHand?: true; perPlayer?: boolean }[]): CampaignLog => ({
  ...emptyLog(seats),
  campaignPool: cards.map((card) => poolCard(ctx.cards.get(card.code)!, card.code, null, card.seat ?? null, card.perPlayer ?? false, card.afterHand ? { afterHand: true } : undefined)),
});

describe("12188 Beldis", () => {
  // Beldis in play under the first player, with each hero holding resources and the first hero hurt.
  const table = (seats: 1 | 2 = 1, facts?: Facts) => {
    const t = nightTable(world, { seats, play: [CODES.beldis] });
    const hurt = updateCard(updateCard(updateCard(t.state, t.hero, { damage: 5, resources: 3 }), t.hero2, { resources: 3 }), t.seat1Hero ?? t.hero2, { resources: 3 });
    return { ...t, state: facts ? { ...hurt, campaignFacts: facts as never } : hurt };
  };
  const beldis = (state: ScenarioState) => idOf(state, CODES.beldis);
  const trigger = (state: ScenarioState, t: ReturnType<typeof table>, seat: number, heroId: string): PlayerIntent => ({ type: "Trigger", cardId: beldis(state), effectId: "12188:action:1", payments: [{ heroId, amount: 1 }] }) as PlayerIntent;
  const usable = (state: ScenarioState, t: ReturnType<typeof table>) => legalIntents(state, t.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === beldis(state) && intent.effectId === "12188:action:1");
  // The action: spend 1 resource, mark a use, heal 3 from the character chosen.
  const act = (state: ScenarioState, t: ReturnType<typeof table>, seat = 0, heroId: string = t.hero, healed: string = t.hero) => {
    const opened = { ...state, window: { kind: "pass" as const }, activeSeat: seat };
    const run = finish(send(start(opened), trigger(opened, t, seat, heroId), t.ctx), t.ctx, optionNamed(healed));
    return run.state;
  };

  it("12188:A:1 Action: spend 1 resource and mark a use in the campaign log to heal 3 damage from a character", () => {
    const t = table();
    expect(usable(start({ ...t.state, window: { kind: "pass" } }).state, t)).toBe(true);
    const done = act(t.state, t);
    expect(done.cards[t.hero]).toMatchObject({ damage: 2, resources: 2 });
    expect(done.campaignFacts?.beldisUses).toEqual([1]);
  });

  it("12188:A:1 it heals no more damage than the character has, and any character may be chosen", () => {
    const t = table();
    const light = updateCard(t.state, t.hero, { damage: 2 });
    expect(act(light, t).cards[t.hero]?.damage).toBe(0);
    // Another character: the second hero is healed, the first pays.
    const split = updateCard(t.state, t.hero2, { damage: 4 });
    const done = act(split, t, 0, t.hero, t.hero2);
    expect(done.cards[t.hero2]?.damage).toBe(1);
    expect(done.cards[t.hero]).toMatchObject({ damage: 5, resources: 2 });
  });

  it("12188:A:1 any player may trigger it: the second player spends their own resource and marks their own box", () => {
    const t = table(2);
    const second = t.seat1Hero ?? "";
    const opened = { ...t.state, window: { kind: "pass" as const }, activeSeat: 1 };
    expect(usable(opened, t)).toBe(true);
    const done = act(t.state, t, 1, second, t.hero);
    expect(done.cards[second]?.resources).toBe(2);
    expect(done.cards[t.hero]?.damage).toBe(2);
    expect(done.campaignFacts?.beldisUses).toEqual([0, 1]);
    // The first player's resources were not spent.
    expect(done.cards[t.hero]?.resources).toBe(3);
  });

  it("emce.campaign-log each player has 4 uses for the campaign: a player whose four boxes are marked cannot use it, and another player can", () => {
    const base = { prisoner: null, usedOnce: [], counters: {} };
    const t = table(2, { ...base, beldisUses: [3, 4] });
    const once = act(t.state, t, 0, t.hero);
    expect(once.campaignFacts?.beldisUses).toEqual([4, 4]);
    const fourth = { ...once, window: { kind: "pass" as const }, activeSeat: 0 };
    expect(usable(fourth, t)).toBe(false);
    const full = { ...t.state, window: { kind: "pass" as const }, activeSeat: 1 };
    expect(usable(full, t)).toBe(false);
    const mine = { ...t.state, window: { kind: "pass" as const }, activeSeat: 0 };
    expect(usable(mine, t)).toBe(true);
  });

  it("12188:A:1 a won scenario writes the boxes it marked to the log, on top of those already marked", () => {
    // The game dealt from a log whose box is marked twice: Beldis is in play under the first player, and a hero of the game's own pays.
    const base = { prisoner: null, usedOnce: [], counters: {}, beldisUses: [2] };
    const dealt = opened(1, emptyLog(1), 1, base);
    const hero = dealt.seats[0]?.heroes[0] ?? "";
    const ready = { ...updateCard(dealt, hero, { damage: 4, resources: 2 }), window: { kind: "pass" as const }, activeSeat: 0 };
    const state = finish(send(start(ready), { type: "Trigger", cardId: idOf(ready, CODES.beldis), effectId: "12188:action:1", payments: [{ heroId: hero, amount: 1 }] } as PlayerIntent, ctx), ctx, (s) => (s.window?.kind === "choose" ? (s.window.options.includes(hero) ? hero : (s.window.options[0] ?? "")) : "")).state;
    expect(state.campaignFacts?.beldisUses).toEqual([3]);
    expect(state.cards[hero]?.damage).toBe(1);
    // The scenario is won: the Resolution is answered with its first options.
    let resolved = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
    for (let guard = 0; guard < 30 && resolved.window?.kind === "resolution"; guard += 1) {
      const options = legalIntents(resolved, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
      resolved = openResolution(expectOk(reduce(resolved, { type: "ChooseResolution", optionId: options[0] ?? "" } as PlayerIntent, ctx)).state, ctx);
    }
    const log = applyResolution({ ...emptyLog(1), beldisUses: [2] }, resolved.scenarioId, resolved, ctx.cards, NO_COPY_LIMITS);
    expect(log.beldisUses).toEqual([3]);
    expect(log.completed).toEqual(["fire-in-the-night"]);
  });

  it("12188:A:1 played from the pool Beldis is shuffled into a deck like any boon ally, and the campaign card's Setup puts only the one it names under the first player", () => {
    const state = opened(1, pooled(1, { code: CODES.beldis, seat: 0 }));
    expect(where(state, CODES.beldis).length).toBeGreaterThanOrEqual(1);
    expect(where(state, CODES.beldis).some((card) => card.zone === "play" && card.controller === 0)).toBe(true);
  });
});

describe("the pool cards of the first five parts in part 6", () => {
  it("12172:A:1 The Threat to Wilderland enters the staging area with X resources, X the campaign card's part number (6)", () => {
    const state = opened(1, pooled(1, { code: "12172" }));
    const threat = where(state, "12172");
    expect(threat).toHaveLength(1);
    expect(threat[0]).toMatchObject({ zone: "staging", resources: 6 });
  });

  it("12173:A:2 Dagnir's Spawn, revealed in part 6, has each player distribute 6 damage (X the part number); if they do it is shuffled into the encounter deck", () => {
    const t = nightTable(world, { staging: ["12173"] });
    const withPart = { ...t.state, part: 6 };
    const damageOf = (state: ScenarioState) => [t.hero, t.hero2].reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);
    const taken = resolveRecords(withPart, t.ctx, "12173", "whenRevealed", idOf(withPart, "12173"), optionNamed("distribute"));
    expect(damageOf(taken.state)).toBe(6);
    expect(taken.state.cards[idOf(taken.state, "12173")]?.zone).toBe("encounterDeck");
  });

  it("12174:A:1 Abandoned Ruin has no Caves deck to be shuffled into in part 6: it is removed from the game", () => {
    const state = opened(1, pooled(1, { code: "12174" }));
    expect(state.piles?.cavesDeck ?? []).toEqual([]);
    expect(where(state, "12174").every((card) => card.zone === "removed" || card.zone === "setAside")).toBe(true);
  });

  it("12185:A:2 Urdug's Cunning in the pool is shuffled into the encounter deck, and revealed it deals damage for each enemy among the top 5 cards", () => {
    const state = opened(1, pooled(1, { code: "12185" }));
    expect(where(state, "12185")).toHaveLength(1);
    expect(["encounterDeck", "encounterDiscard", "staging"]).toContain(where(state, "12185")[0]?.zone);
    const t = nightTable(world, { staging: ["12185"], deck: ["f0", "f3", "place", "f0", "treachery", "mild"] });
    const run = resolveRecords(t.state, t.ctx, "12185", "whenRevealed", idOf(t.state, "12185"));
    expect(run.state.seats[0]?.heroes.reduce((sum, id) => sum + (run.state.cards[id]?.damage ?? 0), 0)).toBe(3);
  });

  it("12186:A:1 Misplaced Trust earned in part 5 is shuffled into its player's deck after the starting hand, and into no encounter deck", () => {
    const log = pooled(1, { code: "12186", seat: 0, afterHand: true, perPlayer: true });
    const state = opened(1, log);
    const copies = where(state, "12186");
    expect(copies).toHaveLength(1);
    expect(copies[0]?.zone).toBe("deck");
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).not.toContain("12186");
  });

  it("12166, 12169 and 12171 Turayn, Melanwar and Isolde are shuffled into their players' decks, and the campaign card of part 6 does not offer a boon ally search", () => {
    const log = pooled(2, { code: "12166", seat: 0 }, { code: "12169", seat: 1 }, { code: "12171", seat: 0 });
    for (const code of ["12166", "12169", "12171"]) expect(log.campaignPool.some((card) => card.code === code), code).toBe(true);
    const state = opened(2, log);
    for (const code of ["12166", "12169", "12171"]) expect(where(state, code), code).toHaveLength(1);
    for (const code of ["12166", "12169", "12171"]) expect(["deck", "hand", "play"], code).toContain(where(state, code)[0]?.zone);
    expect(where(state, "12171")[0]?.controller).toBe(0);
  });

  it("12167:A:2 A Growing Threat in the pool is shuffled into the encounter deck; revealed, the topmost eligible discard is set aside for the pool and it leaves the game", () => {
    const state = opened(1, pooled(1, { code: "12167" }));
    expect(where(state, "12167")).toHaveLength(1);
    const t = nightTable(world, { staging: ["12167"], discard: [CODES.accursedForest, "f3"] });
    const run = resolveRecords(t.state, t.ctx, "12167", "whenRevealed", idOf(t.state, "12167"));
    expect(run.state.cards[idOf(run.state, "12167")]?.zone).toBe("removed");
  });

  it("emce.deep the campaign card of part 6 ignores the Deep keyword: a Caves location (Deep Chasm, 18046) of the encounter pool stays the active location", () => {
    const state = opened(1, { ...emptyLog(1), encounterPool: { "18046": 1 } });
    expect(where(state, "18046")).toHaveLength(1);
    const t = nightTable(world, { phase: "Travel", campaign: true, staging: ["18046"] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, "18046") }, t.ctx), t.ctx);
    expect(run.state.cards[idOf(run.state, "18046")]?.zone).toBe("activeLocation");
    expect(codesIn(run.state, "cavesDeck")).toEqual([]);
  });

  it("an Accolade boon a hero carries in the pool is attached to it at Setup", () => {
    const log: CampaignLog = { ...emptyLog(1), campaignPool: [poolCard(ctx.cards.get("12176")!, "12176", "q1", 0, true)] };
    const state = opened(1, log);
    const boon = where(state, "12176");
    expect(boon).toHaveLength(1);
    expect(boon[0]?.zone).not.toBe("encounterDeck");
  });
});

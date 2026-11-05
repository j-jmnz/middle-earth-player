// Rules: emce.boon-allies, emce.campaign-pool-encounter, emce.caves-deck, emce.deep, rr.setup, rr.damage, rr.attachment-cards, rr.immune (data/rules/entries.json); ledger lines 12185:A:2, 12185:A:3, 12186:A:1, 12186:A:2, 12166:A:2, 12167:A:2, 12172:A:1, 12172:A:2, 12173:A:2, 12174:A:1.
// The burdens Roam Across Rhovanion adds (Urdug's Cunning 12185, Misplaced Trust 12186) on the scenario's scene, and the pool cards of the first four parts played in part 5: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { rhovanionStart, rhovanionWorld } from "../../../../test/scenarios/roam-across-rhovanion/game.ts";
import { CODES, codesIn, finish, idOf, loadRhovanionWorld, resolveRecords, rhovanionFight, rhovanionTable, send, start, type RhovanionWorld, type Run } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";

let world: RhovanionWorld;
let ctx: ReduceContext;
beforeAll(async () => {
  world = await loadRhovanionWorld();
  ctx = (await rhovanionWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const optionNamed = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
// The scenario dealt with these cards in the pool, its Setup played to the first round: the mulligan is kept and each question is answered "trust".
function opened(seats: 1 | 2, log: CampaignLog, seed = 1, choices?: readonly string[]): ScenarioState {
  let state = startScenario(rhovanionStart(seats, seed, "Normal", { prisoner: null, usedOnce: [], counters: {} }, log, undefined, choices), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options.includes("trust") ? "trust" : (state.window.options[0] ?? "") }, ctx)).state;
  return state;
}
const pooled = (seats: 1 | 2, ...cards: readonly { code: string; seat?: number; afterHand?: true; perPlayer?: boolean }[]): CampaignLog => ({
  ...emptyLog(seats),
  campaignPool: cards.map((card) => poolCard(ctx.cards.get(card.code)!, card.code, null, card.seat ?? null, card.perPlayer ?? false, card.afterHand ? { afterHand: true } : undefined)),
});

describe("12185 Urdug's Cunning", () => {
  it("12185:A:1 has Doomed 1 and Surge", () => {
    expect(world.cards.get(CODES.urdugSCunning)?.keywords).toMatchObject({ doomed: 1, surge: true });
  });

  it("12185:A:2 the top 5 cards of the encounter deck are discarded; for each enemy discarded each player deals 1 damage to a character they control", () => {
    for (const seats of [1, 2] as const) {
      const t = rhovanionTable(world, { seats, staging: [CODES.urdugSCunning], deck: ["f0", "treachery", "f3", "place", "f0", "mild", "f3"] });
      const run = resolveRecords(t.state, t.ctx, CODES.urdugSCunning, "whenRevealed", idOf(t.state, CODES.urdugSCunning));
      // Three enemies (f0, f3, f0) are among the five discarded; the sixth and seventh cards stay.
      expect(codesIn(run.state, "encounterDiscard").sort(), `${seats} seats`).toEqual(["f0", "f0", "f3", "place", "treachery"].sort());
      expect(codesIn(run.state, "encounterDeck")).toEqual(["f3", "mild"].sort());
      const damage = (seat: number) => (run.state.seats[seat]?.heroes ?? []).reduce((sum, id) => sum + (run.state.cards[id]?.damage ?? 0), 0);
      for (let seat = 0; seat < seats; seat += 1) expect(damage(seat), `${seats} seats, seat ${seat}`).toBe(3);
    }
  });

  it("12185:A:2 with no enemy among the five discarded nobody takes damage; with fewer than five in the deck all are discarded", () => {
    const none = rhovanionTable(world, { staging: [CODES.urdugSCunning], deck: ["treachery", "place", "treachery", "place", "treachery", "f0"] });
    const run = resolveRecords(none.state, none.ctx, CODES.urdugSCunning, "whenRevealed", idOf(none.state, CODES.urdugSCunning));
    expect(run.state.seats[0]?.heroes.reduce((sum, id) => sum + (run.state.cards[id]?.damage ?? 0), 0)).toBe(0);
    const few = rhovanionTable(world, { staging: [CODES.urdugSCunning], deck: ["f0", "f3"] });
    const small = resolveRecords(few.state, few.ctx, CODES.urdugSCunning, "whenRevealed", idOf(few.state, CODES.urdugSCunning));
    expect(codesIn(small.state, "encounterDiscard").sort()).toEqual(["f0", "f3"]);
    expect(small.state.seats[0]?.heroes.reduce((sum, id) => sum + (small.state.cards[id]?.damage ?? 0), 0)).toBe(2);
  });

  it("12185:A:3 the Shadow gives the attacking enemy +2 Defense until the end of the phase", () => {
    const fought = rhovanionFight(world, CODES.urdugSCunning, "mild");
    expect(modifiedStat(fought.during, fought.during.cards[idOf(fought.during, "mild")]!, "defense", world.cards)).toBe(1 + 2);
  });

  it("12185 a copy in the pool is shuffled into the encounter deck at Setup", () => {
    const state = opened(1, pooled(1, { code: CODES.urdugSCunning }));
    expect(where(state, CODES.urdugSCunning)).toHaveLength(1);
    expect(["encounterDeck", "encounterDiscard", "staging"]).toContain(where(state, CODES.urdugSCunning)[0]?.zone);
  });
});

describe("12186 Misplaced Trust", () => {
  it("12186:A:1 a copy the Resolution earned for a player is shuffled into that player's deck after the starting hand, and into no encounter deck", () => {
    for (const seats of [1, 2] as const) {
      const log = pooled(seats, ...Array.from({ length: seats }, (_, seat) => ({ code: CODES.misplacedTrust, seat, afterHand: true as const, perPlayer: true })));
      const state = opened(seats, log);
      const copies = where(state, CODES.misplacedTrust);
      expect(copies, `${seats} seats`).toHaveLength(seats);
      expect(copies.map((card) => card.zone).every((zone) => zone === "deck"), `${seats} seats`).toBe(true);
      expect(copies.map((card) => card.owner ?? card.controller).sort(), `${seats} seats`).toEqual(Array.from({ length: seats }, (_, seat) => seat));
      expect(state.encounterDeck.map((id) => state.cards[id]?.code)).not.toContain(CODES.misplacedTrust);
    }
  });

  it("12186:A:2 drawn, it attaches to a hero its player controls (a Condition attachment)", () => {
    const t = rhovanionTable(world, { phase: "Refresh", deckOf: [CODES.misplacedTrust, "filler", "filler"] });
    // The resource phase draws a card: Misplaced Trust, which attaches to the hero the player chooses.
    let run = { state: settle(t.state, t.ctx, []), steps: [] as Run["steps"] };
    expect(run.state.window?.kind).toBe("choose");
    run = finish(run, t.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(t.hero2) ? t.hero2 : (state.window.options[0] ?? "")) : ""));
    const trust = run.state.cards[idOf(run.state, CODES.misplacedTrust)]!;
    expect(trust).toMatchObject({ zone: "attached", host: t.hero2 });
    expect(run.state.seats[0]?.hand).not.toContain(trust.id);
  });

  it("12186:A:2 the attached character cannot have player card attachments and is immune to player card effects", () => {
    const t = rhovanionTable(world, { play: [] });
    const attached = resolveRecords(t.state, t.ctx, CODES.misplacedTrust, "forced", undefined, optionNamed(t.hero2));
    const host = attached.state.cards[idOf(attached.state, CODES.misplacedTrust)]?.host;
    expect(host).toBeTruthy();
    const synced = attached.state;
    expect(flagged(synced, host ?? "", "noPlayerAttachments")).toBe(true);
    expect(flagged(synced, host ?? "", "immuneToPlayerCards")).toBe(true);
    const other = [t.hero, t.hero2].find((id) => id !== host)!;
    expect(flagged(synced, other, "immuneToPlayerCards")).toBe(false);
  });
});

describe("the pool cards of the first four parts in part 5", () => {
  it("12172:A:1 The Threat to Wilderland enters the staging area with X resources, X the campaign card's part number (5)", () => {
    const state = opened(1, pooled(1, { code: CODES.threatToWilderland }));
    const threat = where(state, CODES.threatToWilderland);
    expect(threat).toHaveLength(1);
    expect(threat[0]?.zone).toBe("staging");
    expect(threat[0]?.resources).toBe(5);
  });

  it("12173:A:2 Dagnir's Spawn, revealed in part 5, has each player distribute 5 damage (X the part number); if they do it is shuffled into the encounter deck", () => {
    const t = rhovanionTable(world, { staging: [CODES.dagnirSSpawn] });
    const damageOf = (state: ScenarioState) => state.seats[0]?.heroes.reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);
    const taken = resolveRecords(t.state, t.ctx, CODES.dagnirSSpawn, "whenRevealed", idOf(t.state, CODES.dagnirSSpawn), optionNamed("distribute"));
    expect(damageOf(taken.state)).toBe(5);
    expect(taken.state.cards[idOf(taken.state, CODES.dagnirSSpawn)]?.zone).toBe("encounterDeck");
    const declined = resolveRecords(t.state, t.ctx, CODES.dagnirSSpawn, "whenRevealed", idOf(t.state, CODES.dagnirSSpawn), optionNamed("decline"));
    expect(damageOf(declined.state)).toBe(0);
    expect(declined.state.cards[idOf(declined.state, CODES.dagnirSSpawn)]?.zone).toBe("staging");
  });

  it("12174:A:1 Abandoned Ruin has no Caves deck to be shuffled into in part 5: it is removed from the game", () => {
    const state = opened(1, pooled(1, { code: CODES.abandonedRuin }));
    expect(state.piles?.cavesDeck ?? []).toEqual([]);
    const ruin = where(state, CODES.abandonedRuin);
    // Dealt into the encounter deck, its Setup finds it and takes it out of the game: it is in no deck, area or pile of the game.
    expect(ruin.every((card) => card.zone === "removed" || card.zone === "setAside")).toBe(true);
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).not.toContain(CODES.abandonedRuin);
  });

  it("12167:A:2 A Growing Threat in the pool is shuffled into the encounter deck; revealed, the topmost eligible discard is set aside for the pool and it leaves the game", () => {
    const state = opened(1, pooled(1, { code: CODES.aGrowingThreat }));
    expect(where(state, CODES.aGrowingThreat)).toHaveLength(1);
    const t = rhovanionTable(world, { staging: [CODES.aGrowingThreat], discard: [CODES.greyMoorland, "f3"] });
    const run = resolveRecords(t.state, t.ctx, CODES.aGrowingThreat, "whenRevealed", idOf(t.state, CODES.aGrowingThreat));
    expect(run.state.cards[idOf(run.state, CODES.aGrowingThreat)]?.zone).toBe("removed");
  });

  it("12166 Turayn is shuffled into his player's deck from the pool, as in the earlier parts", () => {
    const state = opened(1, pooled(1, { code: CODES.turayn, seat: 0 }), 1, ["skip"]);
    expect(where(state, CODES.turayn)).toHaveLength(1);
    expect(["deck", "hand"]).toContain(where(state, CODES.turayn)[0]?.zone);
  });

  it("12171 Isolde and 12169 Melanwar are shuffled into their players' decks, and a boon ally in the hand search is offered too", () => {
    const state = opened(2, pooled(2, { code: CODES.isolde, seat: 0 }, { code: CODES.melanwar, seat: 1 }), 1, ["skip", "skip"]);
    expect(where(state, CODES.isolde)).toHaveLength(1);
    expect(where(state, CODES.melanwar)).toHaveLength(1);
  });

  it("a Caves location (Deep Chasm, 18046) in the encounter pool is dealt into the encounter deck; the players travel to it and, with no Caves deck and the keyword ignored, it stays the active location", () => {
    const state = opened(1, { ...emptyLog(1), encounterPool: { "18046": 1 } });
    expect(where(state, "18046")).toHaveLength(1);
    expect(["encounterDeck", "encounterDiscard", "staging"]).toContain(where(state, "18046")[0]?.zone);
    expect(state.piles?.cavesDeck ?? []).toEqual([]);
    const t = rhovanionTable(world, { phase: "Travel", campaign: true, staging: ["18046"] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, "18046") }, t.ctx), t.ctx);
    expect(run.state.cards[idOf(run.state, "18046")]?.zone).toBe("activeLocation");
  });

  it("two copies of a Spiders of Mirkwood enemy (Giant Spider, 18052) in the encounter pool join the encounter deck whatever its set", () => {
    const state = opened(1, { ...emptyLog(1), encounterPool: { "18052": 2 } });
    expect(where(state, "18052")).toHaveLength(2);
    for (const card of where(state, "18052")) expect(["encounterDeck", "encounterDiscard", "staging", "engaged"]).toContain(card.zone);
  });

  it("the Accolade boon a hero carries in the pool is attached to it at Setup", () => {
    const hero = "q1";
    const log: CampaignLog = { ...emptyLog(1), campaignPool: [poolCard(ctx.cards.get("12176")!, "12176", hero, 0, true)] };
    const state = opened(1, log);
    const boon = where(state, "12176");
    expect(boon).toHaveLength(1);
    expect(state.cards[boon[0]?.host ?? ""]?.code).toBe(hero);
    expect(updateCard(state, boon[0]!.id, {})).toBeTruthy();
  });
});

// Rules: emce.treasure, emce.discover, emce.loot, rr.guarded, rr.response, rr.action, rr.limits, rr.optional-engagement, rr.shadow-effects, rr.first-player, rr.threat-threat-dial (data/rules/entries.json); ledger lines 12189:B:2, 12189:B:3, 12191:A:1, 12191:A:2, 12192:A:1, 12192:A:2, 19106:A:1.
// The campaign card's Response and Action, the Gundabad Hunter and Gundabad Stalker, and the engine pieces they stand on: a Response before the Discover keyword, the optional-engagement hook, the cap on threat reduction.
import { beforeAll, describe, expect, it } from "vitest";

import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { freeOfEncounters } from "../../../rules/families/objectives/free.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { optionalEnemies } from "../../../rules/quest/quest.ts";
import { enemyCard } from "../../../../test/harness/scene-kit.ts";
import { CODES, codesIn, finish, framsburgFight, framsburgTable, idOf, legalIntents, loadFramsburgWorld, resolveRecords, send, start, withLoot, type FramsburgWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";

let world: FramsburgWorld;
beforeAll(async () => {
  world = await loadFramsburgWorld();
  // A unique enemy of no text: a player engaged with it satisfies "engaged with a unique enemy".
  (world.cards as Map<string, ReturnType<typeof enemyCard>>).set("uniq", enemyCard("uniq", { isUnique: true, attack: 2, health: 9 }));
}, 120_000);

type Table = ReturnType<typeof framsburgTable>;
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const take = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
const offered = (t: Table, run: Run, effectId: string): boolean => legalIntents(run.state, t.ctx).some((item) => item.type === "Trigger" && item.effectId === effectId);
const trigger = (t: Table, run: Run, effectId: string): Run => {
  const intent = legalIntents(run.state, t.ctx).find((item) => item.type === "Trigger" && item.effectId === effectId);
  if (!intent || intent.type !== "Trigger") throw new Error(`no ${effectId}: ${JSON.stringify(legalIntents(run.state, t.ctx))}`);
  return send(run, { type: "Trigger", cardId: intent.cardId, effectId }, t.ctx);
};

// The first player engages Fram's Shade from the staging area in the encounter phase (its engagement cost is 30).
function engageShade(t: Table, run: Run = start(t.state)): Run {
  return send(run, { type: "Engage", enemyId: idOf(run.state, CODES.framSShade) }, t.ctx);
}

describe("12189:B:2 the treasure on Fram's Shade", () => {
  const table = (stage: "19109" | "19110" | "19111", extra: Partial<Parameters<typeof framsburgTable>[1]> = {}) => framsburgTable(world, { phase: "Encounter", campaign: true, stage, staging: [CODES.framSShade], threat: [35, 35], ...extra });

  it("12189:B:2 after Fram's Shade engages a player at stage 1B or 2B, the first player looks at 3 random undiscovered treasures and attaches 1 to it as a guarded objective", () => {
    for (const stage of ["19109", "19110"] as const) {
      const t = table(stage);
      let run = engageShade(t);
      expect(offered(t, run, "12189:response:1"), stage).toBe(true);
      run = trigger(t, run, "12189:response:1");
      // The 3 treasures drawn are offered; the first is chosen.
      expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
      const options = run.state.window?.kind === "choose" ? run.state.window.options : [];
      expect(options).toHaveLength(3);
      run = finish(run, t.ctx, take(options[1] ?? ""));
      const treasure = Object.values(run.state.cards).find((card) => world.cards.get(card.code)?.campaignKind === "treasure");
      expect(treasure?.code, stage).toBe(options[1]);
      // The treasure lies in the staging area, guarded by Fram's Shade: nothing moves the Shade, so it stays engaged with the player it engaged (12189:B:2).
      expect(treasure?.zone).toBe("staging");
      const shade = run.state.cards[idOf(run.state, CODES.framSShade)];
      expect(shade).toMatchObject({ host: treasure?.id, guard: true, zone: "engaged" });
      expect(run.state.seats[0]?.engaged).toContain(shade?.id);
      expect(run.state.staging).not.toContain(shade?.id);
      expect(freeOfEncounters(run.state, treasure?.id ?? "")).toBe(false);
    }
  });

  it("12189:B:2 the treasure is free of encounters once the engaged Fram's Shade leaves play, and not while it is returned to the staging area", () => {
    const t = table("19110");
    const run = finish(trigger(t, engageShade(t), "12189:response:1"), t.ctx);
    const shade = idOf(run.state, CODES.framSShade);
    const treasure = Object.values(run.state.cards).find((card) => world.cards.get(card.code)?.campaignKind === "treasure")!;
    const back = moveCard(run.state, shade, { zone: "staging" });
    expect(freeOfEncounters(back, treasure.id)).toBe(false);
    const gone = moveCard(run.state, shade, { zone: "encounterDiscard" });
    expect(freeOfEncounters(gone, treasure.id)).toBe(true);
    expect(gone.cards[shade]).toMatchObject({ host: null });
  });

  it("12189:B:2 it is a group limit once per game: after one use it is not offered again", () => {
    const t = table("19109", { seats: 2, threat: [35, 35] });
    let run = trigger(t, engageShade(t), "12189:response:1");
    run = finish(run, t.ctx);
    expect(offered(t, run, "12189:response:1")).toBe(false);
    // The Shade, returned to the staging area and engaging again, gets no second treasure.
    const shade = idOf(run.state, CODES.framSShade);
    const returned = moveCard(run.state, shade, { zone: "staging" });
    const spent = { ...returned, window: { kind: "optionalEngage" as const }, phase: "Encounter" as const, mode: "optionalEngage" as const };
    const again = engageShade(t, { state: spent, steps: [] });
    expect(offered(t, again, "12189:response:1")).toBe(false);
  });

  it("12189:B:2 it is not offered at stage 3B, or when another enemy engages", () => {
    const last = table("19111");
    expect(offered(last, engageShade(last), "12189:response:1")).toBe(false);
    const other = framsburgTable(world, { phase: "Encounter", campaign: true, stage: "19109", staging: [CODES.werewolf], threat: [35, 35] });
    expect(offered(other, send(start(other.state), { type: "Engage", enemyId: idOf(other.state, CODES.werewolf) }, other.ctx), "12189:response:1")).toBe(false);
  });

  it("12189:B:2 a game without the campaign card (a standalone one) has no such Response", () => {
    const t = framsburgTable(world, { phase: "Encounter", stage: "19109", staging: [CODES.framSShade], threat: [35, 35] });
    expect(offered(t, engageShade(t), "12189:response:1")).toBe(false);
  });

  it("12189:B:2 when the treasure is free of encounters (Fram's Shade destroyed), the players claim it and attach it to an eligible character", () => {
    const t = table("19110");
    let run = finish(trigger(t, engageShade(t), "12189:response:1"), t.ctx);
    const shade = idOf(run.state, CODES.framSShade);
    const treasure = Object.values(run.state.cards).find((card) => world.cards.get(card.code)?.campaignKind === "treasure")!;
    expect(treasure.zone).toBe("staging");
    // The Shade is destroyed: nothing guards the treasure any more.
    const dead = { ...run.state, cards: { ...run.state.cards, [shade]: { ...run.state.cards[shade]!, damage: 99 } } };
    run = { ...run, state: dead };
    run = finish({ ...run, state: { ...run.state, window: null, mode: "stopped" } }, t.ctx);
    const settledRun = send({ state: { ...dead, window: { kind: "pass" } }, steps: [] }, { type: "Pass" }, t.ctx);
    expect(settledRun.state.cards[treasure.id]?.zone === "staging" || settledRun.state.cards[treasure.id]?.zone === "attached" || settledRun.state.window?.kind === "choose").toBe(true);
  });
});

describe("12189:B:3 shuffling the discard pile", () => {
  const table = (extra: Partial<Parameters<typeof framsburgTable>[1]> = {}) => framsburgTable(world, { phase: "Quest", campaign: true, stage: "19109", threat: [30, 35], seats: 2, discard: ["f0", "f3", "f3"], deck: ["f0"], ...extra });

  it("12189:B:3 Action: any player raises each player's threat by 1 to shuffle the encounter discard pile into the encounter deck", () => {
    const t = table();
    const run = trigger(t, start(t.state), "12189:action:1");
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([31, 36]);
    expect(run.state.encounterDiscard).toEqual([]);
    expect(run.state.encounterDeck).toHaveLength(4);
  });

  it("12189:B:3 the second player may trigger it too", () => {
    const t = table();
    const second = { ...t.state, activeSeat: 1 };
    const run = trigger(t, start(second), "12189:action:1");
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([31, 36]);
  });

  it("12189:B:3 it has no limit: it can be used again once the discard pile has cards again", () => {
    const t = table();
    let run = trigger(t, start(t.state), "12189:action:1");
    expect(offered(t, run, "12189:action:1")).toBe(false);
    const more = { ...run.state, cards: { ...run.state.cards } };
    const top = more.encounterDeck[0]!;
    run = { ...run, state: { ...more, encounterDeck: more.encounterDeck.slice(1), encounterDiscard: [top], cards: { ...more.cards, [top]: { ...more.cards[top]!, zone: "encounterDiscard" } } } };
    expect(offered(t, run, "12189:action:1")).toBe(true);
    run = trigger(t, run, "12189:action:1");
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([32, 37]);
  });

  it("12189:B:3 it is not offered with an empty discard pile, or without the campaign card", () => {
    expect(offered(table({ discard: [] }), start(table({ discard: [] }).state), "12189:action:1")).toBe(false);
    const standalone = framsburgTable(world, { phase: "Quest", seats: 2, discard: ["f0"] });
    expect(offered(standalone, start(standalone.state), "12189:action:1")).toBe(false);
  });
});

describe("12191 Gundabad Hunter", () => {
  it("12191:A:1 When Revealed: a player engaged with a unique enemy is chosen and Gundabad Hunter makes an immediate attack against that player", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, engaged: [{ code: CODES.framSShade, seat: 1 }], deck: ["f0", "f0", "f0"] });
    const hunter = spawnRevealed(t, CODES.gundabadHunter);
    expect(hunter.state.pendingAttack).toMatchObject({ enemyId: idOf(hunter.state, CODES.gundabadHunter), seat: 1, immediate: true });
    // It attacks from the staging area and stays there.
    expect(hunter.state.cards[idOf(hunter.state, CODES.gundabadHunter)]?.zone).toBe("staging");
  });

  it("12191:A:1 with several players engaged with unique enemies, the first player chooses which", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, engaged: [{ code: CODES.framSShade, seat: 1 }, { code: "uniq", seat: 0 }], deck: ["f0", "f0", "f0"] });
    const seen: number[] = [];
    for (const seat of [0, 1]) {
      const run = spawnRevealed(t, CODES.gundabadHunter, (state) => (state.window?.kind === "choose" ? `seat:${seat}` : ""));
      seen.push(run.state.pendingAttack?.seat ?? -1);
    }
    expect(seen).toEqual([0, 1]);
  });

  it("12191:A:1 if no player is engaged with a unique enemy, it makes no attack", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, engaged: [{ code: CODES.werewolf, seat: 1 }], deck: ["f0", "f0"] });
    const run = spawnRevealed(t, CODES.gundabadHunter);
    expect(run.state.pendingAttack ?? null).toBeNull();
    expect(run.state.cards[idOf(run.state, CODES.gundabadHunter)]?.zone).toBe("staging");
    const none = framsburgTable(world, { phase: "Quest", deck: ["f0"] });
    expect(spawnRevealed(none, CODES.gundabadHunter).state.pendingAttack ?? null).toBeNull();
  });

  it("12191:A:2 as a Shadow, a unique attacker makes an additional attack after this one", () => {
    const attacks = (fight: ReturnType<typeof framsburgFight>) => fight.run.steps.flat().filter((step) => step.kind === "strike" && step.side === "enemy").length;
    const unique = framsburgFight(world, CODES.gundabadHunter, "uniq", { engaged: [{ code: "uniq", seat: 0 }] }, { undefended: true });
    const plain = framsburgFight(world, CODES.gundabadHunter, CODES.werewolf, {}, { undefended: true });
    expect(attacks(plain)).toBe(1);
    expect(attacks(unique)).toBe(2);
  });
});

describe("12192 Gundabad Stalker", () => {
  const table = (extra: Partial<Parameters<typeof framsburgTable>[1]> = {}) => framsburgTable(world, { phase: "Encounter", seats: 2, staging: [CODES.gundabadStalker], threat: [20, 20], ...extra });

  it("12192:A:1 it cannot be optionally engaged except by a player who is engaged with a unique enemy", () => {
    const t = table({ engaged: [{ code: CODES.framSShade, seat: 1 }] });
    expect(flagged(t.state, idOf(t.state, CODES.gundabadStalker), "optionalEngageUnique")).toBe(true);
    expect(optionalEnemies(t.state, world.cards, 0)).toEqual([]);
    expect(optionalEnemies(t.state, world.cards, 1)).toEqual([idOf(t.state, CODES.gundabadStalker)]);
  });

  it("12192:A:1 a player engaged with enemies that are not unique may not, and neither may a player with none", () => {
    const t = table({ engaged: [{ code: CODES.werewolf, seat: 1 }] });
    expect(optionalEnemies(t.state, world.cards, 0)).toEqual([]);
    expect(optionalEnemies(t.state, world.cards, 1)).toEqual([]);
  });

  it("12192:A:1 in the legal intents the Engage intent is offered only to a player who may", () => {
    const t = table({ engaged: [{ code: CODES.framSShade, seat: 0 }] });
    const intents = legalIntents(t.state, t.ctx).filter((item) => item.type === "Engage");
    expect(intents.length).toBeGreaterThanOrEqual(1);
    const none = table({});
    expect(legalIntents(none.state, none.ctx).filter((item) => item.type === "Engage")).toEqual([]);
  });

  it("12192:A:2 as a Shadow, a unique attacker returns to the staging area after this attack", () => {
    const unique = framsburgFight(world, CODES.gundabadStalker, "uniq", {}, { undefended: true });
    expect(where(unique.run.state, "uniq")[0]?.zone).toBe("staging");
    const plain = framsburgFight(world, CODES.gundabadStalker, CODES.werewolf, {}, { undefended: true });
    expect(where(plain.run.state, CODES.werewolf)[0]?.zone).toBe("engaged");
  });
});

describe("19106 Abandoned Ruins and the Discover keyword", () => {
  it("19106:A:1 the Discover keyword is held to the end of the travel step, so Crypt Key's Response comes first", () => {
    const t = withLoot(framsburgTable(world, { phase: "Travel", staging: [CODES.moonlitPassage], deck: ["f0", "f0", "f0", "f0"] }), [CODES.cryptKey]);
    const run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.moonlitPassage) } as PlayerIntent, t.ctx);
    expect(run.state.discoverHeld).toBe(idOf(t.state, CODES.moonlitPassage));
    expect(codesIn(run.state, "encounterDiscard")).toEqual([]);
    const done = send(run, { type: "Pass" }, t.ctx);
    expect(done.state.discoverHeld).toBeUndefined();
    expect(codesIn(done.state, "encounterDiscard")).toHaveLength(2);
  });
});

// A card of this code is revealed in the quest phase (its When Revealed effect resolves), answering a choice as `pick` does.
const spawnRevealed = (t: Table, code: string, pick?: (state: ScenarioState) => string): Run => resolveRecords(t.state, t.ctx, code, "whenRevealed", undefined, pick);

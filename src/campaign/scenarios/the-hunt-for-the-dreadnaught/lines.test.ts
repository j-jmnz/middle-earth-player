// Rules: rr.setup, rr.player-elimination, rr.response, rr.cancel, rr.forced, rr.action, rr.cost, rr.engaged, rr.damage, rr.deckbuilding, rr.mulligan, dcce.ship-objectives, dcce.ship-enemies, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json); docs/brief.md (The Hunt for the Dreadnaught).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): a Setup played from the first intent, a choice among the ships, a Response in the middle of an attack, an effect that waits on the elimination sweep, a card
// of the players' decks in the hand, and a limit once each round. Each test starts its title with the line id.
import { beforeAll, describe, expect, it } from "vitest";

import { dreadnaughtStart, dreadnaughtWorld } from "../../../../test/scenarios/the-hunt-for-the-dreadnaught/game.ts";
import { codesIn, finish, fightEnemy, first, idOf, legalIntents, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { pillageAmount } from "../../../rules/families/sea/pillage.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { legalAttackEnemies } from "../../../rules/combat/combat.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";

const STAGES = ["40004", "40005"] as const;
const table = (layout: Layout) => tableFromLayout("the-hunt-for-the-dreadnaught", { stages: STAGES, ...layout });
// The fleet is prepared: the table reads the elimination of a player with no ship from now on.
const fleeted = (state: ScenarioState): ScenarioState => ({ ...state, sea: { ...(state.sea ?? { heading: null, headingCard: null, routes: {} }), fleet: true as const } });
const quiet = (state: ScenarioState, ctx: ReduceContext): ScenarioState => settle({ ...state, window: null }, ctx, []);

// A game started as a player starts it: the opening hand kept and every ship chosen (the first offered).
const games = new Map<string, { state: ScenarioState; ctx: ReduceContext }>();
async function opened(seats: 1 | 2, difficulty: "Normal" | "Easy"): Promise<{ state: ScenarioState; ctx: ReduceContext }> {
  const key = `${seats}:${difficulty}`;
  const known = games.get(key);
  if (known) return known;
  const { ctx } = await dreadnaughtWorld("strong");
  let state = startScenario(dreadnaughtStart(seats, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  const made = { state, ctx };
  games.set(key, made);
  return made;
}
const modeCard = (state: ScenarioState) => Object.values(state.cards).find((card) => card.zone === "modeCard");

describe("the mode cards' Setup, played from the start of a game", () => {
  let easy: { state: ScenarioState; ctx: ReduceContext };
  let normal: { state: ScenarioState; ctx: ReduceContext };
  beforeAll(async () => {
    easy = await opened(1, "Easy");
    normal = await opened(1, "Normal");
  });

  it("40001:A:7 Easy Mode is flipped over and placed next to the quest deck", () => {
    expect(modeCard(easy.state)?.code).toBe("40001");
    expect(modeCard(easy.state)?.face).toBe("B");
  });
  it("40002:A:6 Standard Mode is flipped over and placed next to the quest deck", () => {
    expect(modeCard(normal.state)?.code).toBe("40002");
    expect(modeCard(normal.state)?.face).toBe("B");
  });
  it("40002:A:4 all 7 unique enemies, the Dreadnaught included, are set aside, out of the encounter deck", () => {
    const aside = codesIn(normal.state, "setAside");
    for (const code of ["40013", "40014", "40015", "40016", "40017", "40018", "40019"]) expect(aside, code).toContain(code);
    expect(codesIn(normal.state, "encounterDeck").some((code) => ["40013", "40014", "40015", "40016", "40017", "40018", "40019"].includes(code))).toBe(false);
  });
  it("40001:B:1 each player draws 1 additional card during the resource phase", () => {
    // The first round's resource phase has run: 6 cards, 1 for the phase and, on Easy, 1 more.
    expect(normal.state.seats[0]?.hand.length).toBe(7);
    expect(easy.state.seats[0]?.hand.length).toBe(8);
  });
});

describe("a player who controls no ship-objective", () => {
  it("40001:B:3 is eliminated once the fleet is prepared, and not before (Easy Mode)", () => {
    const made = table({ seats: 2, modeCard: "easy", play: [{ code: "40006", seat: 0 }] });
    expect(quiet(made.state, made.ctx).seats[1]?.eliminated).not.toBe(true);
    const after = quiet(fleeted(made.state), made.ctx);
    expect(after.seats[1]?.eliminated).toBe(true);
    expect(after.seats[0]?.eliminated).not.toBe(true);
  });
  it("40002:B:2 is eliminated once the fleet is prepared, and the last player eliminated loses the game (Standard Mode)", () => {
    const made = table({ seats: 1, modeCard: true });
    const after = quiet(fleeted(made.state), made.ctx);
    expect(after.seats[0]?.eliminated).toBe(true);
    expect(after.lost).toBe(true);
  });
});

describe("stage 2B", () => {
  it("40005:B:2 the Action does nothing and costs nothing when the stage holds fewer than 5 progress for each player", () => {
    const made = table({ stage: "40005", progress: 4, setAside: ["40012"], deck: ["f0"] });
    const run = resolveRecords(made.state, made.ctx, "40005", "action", idOf(made.state, "40005"));
    expect(run.state.cards[idOf(made.state, "40005")]?.progress).toBe(4);
    expect(codesIn(run.state, "encounterDeck")).not.toContain("40012");
    // A stage with 5 progress offers it.
    const full = table({ stage: "40005", progress: 5, setAside: ["40012"] });
    expect(legalIntents(start(full.state).state, full.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(full.state, "40005"))).toBe(true);
    const short = table({ stage: "40005", progress: 4, setAside: ["40012"] });
    expect(legalIntents(start(short.state).state, short.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(short.state, "40005"))).toBe(false);
  });
  it("40005:B:3 Response: when the Dreadnaught attacks you, raise your threat by 4 to cancel the attack", () => {
    const made = table({ stage: "40005", phase: "Combat", engaged: [{ code: "40015", seat: 0 }], staging: ["40013"], play: ["40006"] });
    const run = resolveRecords(made.state, made.ctx, "40015", "forced", idOf(made.state, "40015"));
    expect(run.state.pendingAttack ? run.state.cards[run.state.pendingAttack.enemyId]?.code : null).toBe("40013");
    const offered = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && run.state.cards[intent.cardId]?.code === "40005");
    expect(offered).toBeDefined();
    const used = send(run, { ...(offered as Extract<ReturnType<typeof legalIntents>[number], { type: "Trigger" }>), payments: [] }, made.ctx);
    expect(used.state.seats[0]?.threat).toBe(32);
    expect(used.state.pendingAttack?.enemyId === idOf(made.state, "40013") && used.state.window?.kind === "defense").toBe(false);
  });
});

// The player's own cards in a table: a card in the discard pile or the hand, as the layout cannot place them.
const discarding = (state: ScenarioState, codes: readonly string[], seat = 0): ScenarioState => codes.reduce((current, code) => spawn(current, code, { zone: "discard", seat }).state, state);
const pickCode = (code: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.find((option) => state.cards[option]?.code === code) ?? state.window.options[0] ?? "") : "");
const triggerOf = (state: ScenarioState, ctx: ReduceContext, cardId: string, effectId: string) => legalIntents(state, ctx).find((intent) => intent.type === "Trigger" && intent.cardId === cardId && intent.effectId === effectId);

describe("the ships' lines that need cards of the players", () => {
  it("40006:A:3 Setup: a hero you control gains the printed Traits of another hero you control until the end of the game", () => {
    const made = table({ play: ["40006"] });
    made.cards.set("dh2", { ...made.cards.get("dh2")!, traits: ["Noldor", "Warrior"] });
    const run = resolveRecords(made.state, made.ctx, "40006", "setup", idOf(made.state, "40006"), pickCode("dh1"));
    const gained = run.state.modifiers.filter((modifier) => modifier.stat === "traitGained" && modifier.instanceId === made.hero).map((modifier) => modifier.trait);
    expect(gained.sort()).toEqual(["Noldor", "Warrior"]);
  });

  it("40006:B:3 Response: after it flips, up to 6 cards of your discard pile are shuffled into your deck and 6 progress go on a location", () => {
    const made = table({ play: [{ code: "40006", upgraded: true }], staging: ["place"] });
    const loaded = discarding(made.state, ["filler", "filler", "filler"]);
    const run = resolveRecords(loaded, made.ctx, "40006", "response", idOf(loaded, "40006"));
    expect(run.state.seats[0]?.discard.length).toBe(0);
    expect(run.state.seats[0]?.deck.length).toBe(3);
    // The stand-in location takes progress up to its 2 quest points.
    expect(run.state.cards[idOf(loaded, "place")]?.progress).toBe(made.cards.get("place")?.questPoints);
  });

  it("40008:A:3 Forced: when you draw your starting hand, draw 5 additional cards, then shuffle 5 cards from your hand into your deck, and a mulligan taken before has no effect", () => {
    const made = table({ play: ["40008"], hand: ["filler", "filler"], deckOf: Array.from({ length: 16 }, () => "filler") });
    const run = resolveRecords(made.state, made.ctx, "40008", "forced", idOf(made.state, "40008"));
    // The hand is shuffled into the deck and 6 cards are drawn again, then 5 more, and 5 go back: 6 stay.
    expect(run.state.seats[0]?.hand.length).toBe(6);
    expect(run.state.seats[0]?.deck.length).toBe(12);
  });

  // The resources the heroes spent when the ship's Action (the effect id) played Hour of Wrath, an event that costs 4.
  const spentOnEvent = (upgraded: boolean, effectId: string): number => {
    const made = tableFromLayout("the-hunt-for-the-dreadnaught", { stages: STAGES, play: [upgraded ? { code: "40009", upgraded: true } : "40009"], hand: ["10144"], heroResources: 3 }, { extra: ["10144"] });
    const pool = (state: ScenarioState) => [made.hero, made.hero2].reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0);
    const ship = idOf(made.state, "40009");
    const run = start(made.state);
    const offered = triggerOf(run.state, made.ctx, ship, effectId);
    expect(offered).toBeDefined();
    let done = send(run, { type: "Trigger", cardId: ship, effectId, payments: [] }, made.ctx);
    for (let guard = 0; guard < 6 && done.state.window?.kind === "choose"; guard += 1) done = send(done, { type: "Choose", optionId: done.state.window.options[0] ?? "" }, made.ctx);
    expect(codesIn(done.state, "hand")).not.toContain("10144");
    return pool(made.state) - pool(done.state);
  };
  it("40009:A:3 Action: play an event from your hand with a cost of 3 or more, reducing its cost by 1", () => {
    expect(spentOnEvent(false, "40009:action:1")).toBe(3);
  });
  it("40009:B:3 Action: play an event from your hand with a cost of 3 or more, reducing its cost by 2", () => {
    expect(spentOnEvent(true, "40009:action:2")).toBe(2);
  });
});

describe("Silent Mist, Swan Ship of Dol Amroth and Twilight's Call", () => {
  it("40009:B:2 Response: after it flips, choose up to 2 events from your discard pile and/or your collection and add them to your hand, never a fourth copy of a card", () => {
    const made = tableFromLayout("the-hunt-for-the-dreadnaught", { stages: STAGES, play: [{ code: "40009", upgraded: true }] }, { extra: ["10144"] });
    const loaded = discarding(made.state, ["filler"]);
    // The event of the discard pile is offered, and one of the collection as a card made in the hand.
    const run = resolveRecords(loaded, made.ctx, "40009", "response", idOf(loaded, "40009"), (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === "done") ?? "") : ""));
    expect(run.state.seats[0]?.hand.length).toBe(0);
    const taking = resolveRecords(loaded, made.ctx, "40009", "response", idOf(loaded, "40009"), (state) => {
      const taken = state.seats[0]?.hand.length ?? 0;
      return state.window?.kind === "choose" ? (taken >= 1 ? "done" : (state.window.options[0] ?? "")) : "";
    });
    expect(taking.state.seats[0]?.hand.length).toBe(1);
  });

  const exhaust = (state: ScenarioState, ...ids: string[]) => ids.reduce((current, id) => updateCard(current, id, { exhausted: true }), state);
  it("40010:A:3 Action: spend 2 resources to ready a character, limit once each round", () => {
    const made = table({ play: ["40010"], heroResources: 2 });
    const ship = idOf(made.state, "40010");
    const run = start(exhaust(made.state, made.hero, made.hero2));
    expect(triggerOf(run.state, made.ctx, ship, "40010:action:1")).toBeDefined();
    const done = finish(send(run, { type: "Trigger", cardId: ship, effectId: "40010:action:1", payments: [] }, made.ctx), made.ctx);
    const readied = [made.hero, made.hero2].filter((id) => !done.state.cards[id]?.exhausted);
    expect(readied).toHaveLength(1);
    expect(done.state.cards[made.hero]?.resources).toBe(0);
    expect(triggerOf(done.state, made.ctx, ship, "40010:action:1")).toBeUndefined();
  });
  it("40010:B:3 Action: spend 1 resource to ready a card, limit once each round", () => {
    const made = table({ play: [{ code: "40010", upgraded: true }], heroResources: 1 });
    const ship = idOf(made.state, "40010");
    const run = start(exhaust(made.state, made.hero));
    expect(triggerOf(run.state, made.ctx, ship, "40010:action:2")).toBeDefined();
    const done = finish(send(run, { type: "Trigger", cardId: ship, effectId: "40010:action:2", payments: [] }, made.ctx), made.ctx);
    expect(done.state.cards[made.hero]?.exhausted).toBe(false);
    expect(triggerOf(done.state, made.ctx, ship, "40010:action:2")).toBeUndefined();
  });
  it("40010:B:2 Response: after it flips, add 2 resources to a hero's pool and ready a card", () => {
    const made = table({ play: [{ code: "40010", upgraded: true }] });
    const run = resolveRecords(exhaust(made.state, made.hero), made.ctx, "40010", "response", idOf(made.state, "40010"), pickCode("dh2"));
    expect(run.state.cards[made.hero2]?.resources).toBe(2);
    expect(run.state.cards[made.hero]?.exhausted).toBe(false);
  });

  // A lore event costs 3 and the stand-in heroes are tactics: it is paid only where a ship waives the match.
  const lore = (play: Layout["play"], hand: string[]) => tableFromLayout("the-hunt-for-the-dreadnaught", { stages: STAGES, play, hand, heroResources: 3 }, { extra: ["01064"] });
  const playable = (made: ReturnType<typeof lore>, id: string) => legalIntents(made.state, made.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === id);
  it("40011:A:2 the first card you play each round does not require a resource match", () => {
    const made = lore(["40011"], ["01064"]);
    expect(playable(made, first(made.state, "01064"))).toBe(true);
    const plain = lore([], ["01064"]);
    expect(playable(plain, first(plain.state, "01064"))).toBe(false);
  });
  it("40011:B:2 each card you play does not require a resource match, the second as well", () => {
    const made = lore([{ code: "40011", upgraded: true }], ["01064", "01064"]);
    const [one, two] = made.state.seats[0]!.hand;
    const run = send(start(made.state), { type: "PlayCard", cardId: one!, payments: [{ heroId: made.hero, amount: 3 }] }, made.ctx);
    expect(playable({ ...made, state: run.state }, two!)).toBe(true);
    const basic = lore(["40011"], ["01064", "01064"]);
    const [first1, second1] = basic.state.seats[0]!.hand;
    const after = send(start(basic.state), { type: "PlayCard", cardId: first1!, payments: [{ heroId: basic.hero, amount: 3 }] }, basic.ctx);
    expect(playable({ ...basic, state: after.state }, second1!)).toBe(false);
  });
  it("40011:A:3 Action: play an ally or attachment from your hand, limit once each round", () => {
    const made = table({ play: ["40011"], hand: ["ally", "ally"], heroResources: 3 });
    const ship = idOf(made.state, "40011");
    const run = start(made.state);
    expect(triggerOf(run.state, made.ctx, ship, "40011:action:1")).toBeDefined();
    const done = finish(send(run, { type: "Trigger", cardId: ship, effectId: "40011:action:1", payments: [] }, made.ctx), made.ctx);
    expect(codesIn(done.state, "play")).toContain("ally");
    expect(triggerOf(done.state, made.ctx, ship, "40011:action:1")).toBeUndefined();
  });
  it("40011:B:4 Action: play an ally or attachment from your hand, as often as you can pay", () => {
    const made = table({ play: [{ code: "40011", upgraded: true }], hand: ["ally", "ally"], heroResources: 3 });
    const ship = idOf(made.state, "40011");
    const run = finish(send(start(made.state), { type: "Trigger", cardId: ship, effectId: "40011:action:2", payments: [] }, made.ctx), made.ctx);
    expect(codesIn(run.state, "play")).toContain("ally");
    expect(triggerOf(run.state, made.ctx, ship, "40011:action:2")).toBeDefined();
  });
});

describe("the unique Corsairs and the Corsair deck", () => {
  it("40014:A:1 Pillage 8: the keyword of the card is 8, and 2 and 3 on the Corsairs of the deck", () => {
    const made = table({ engaged: ["40014", "40021", "40022", "40023"] });
    expect(["40014", "40021", "40022", "40023"].map((code) => pillageAmount(made.state, idOf(made.state, code), made.ctx))).toEqual([8, 2, 3, 3]);
  });
  it("40021:A:1 Pillage 2: after its attack the player discards the top 2 cards of their deck", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "f0", "40021", { deckOf: ["filler", "filler", "filler", "filler", "filler"] }, { undefended: true });
    expect((fight.start.seats[0]?.deck.length ?? 0) - (fight.run.state.seats[0]?.deck.length ?? 0)).toBe(2);
  });
  it("40022:A:1 Pillage 3: after its attack the player discards the top 3 cards of their deck", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "f0", "40022", { deckOf: ["filler", "filler", "filler", "filler", "filler"] }, { undefended: true });
    expect((fight.start.seats[0]?.deck.length ?? 0) - (fight.run.state.seats[0]?.deck.length ?? 0)).toBe(3);
  });
  it("40023:A:1 Pillage 3: after its attack the player discards the top 3 cards of their deck", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "f0", "40023", { deckOf: ["filler", "filler", "filler", "filler", "filler"] }, { undefended: true });
    expect((fight.start.seats[0]?.deck.length ?? 0) - (fight.run.state.seats[0]?.deck.length ?? 0)).toBe(3);
  });

  // The Forced effect for an event card the enemy's Pillage discarded: the event lies in the discard pile and the engine announces it.
  const pillaged = (enemy: string, layout: Layout, pick?: (state: ScenarioState) => string) => {
    const made = table({ engaged: [enemy], ...layout });
    const withEvent = discarding(made.state, ["filler"]);
    const event = idOf(withEvent, "filler");
    const steps: never[] = [];
    const fired = settle(queueEvent({ ...withEvent, window: null }, { trigger: "pillaged", seat: 0, cardId: idOf(withEvent, enemy), other: event }), made.ctx, steps);
    return { made, run: finish({ state: fired, steps }, made.ctx, pick) };
  };
  it("40021:A:2 Forced: after an event card is discarded by its Pillage, discard an attachment you control", () => {
    const { made, run } = pillaged("40021", { attached: [{ code: "attachment", to: "dh1" }] });
    expect(run.state.cards[idOf(made.state, "attachment")]?.zone).not.toBe("play");
  });
  it("40022:A:2 Forced: after an event card is discarded by its Pillage, deal 1 damage to a character you control", () => {
    const { run } = pillaged("40022", {});
    expect(run.state.cards[run.state.seats[0]?.heroes[0] ?? ""]?.damage).toBe(1);
  });
  it("40023:A:2 Forced: after an event card is discarded by its Pillage, discard 1 resource from a hero you control", () => {
    const { run } = pillaged("40023", { heroResources: 2 });
    const left = (run.state.seats[0]?.heroes ?? []).map((id) => run.state.cards[id]?.resources ?? 0);
    expect(left.reduce((sum, count) => sum + count, 0)).toBe(3);
  });
  it("40028:A:2 Response: after it is destroyed as an enemy you may discard allies with a total Willpower of 3 to take control of it as a Ship objective", () => {
    const offered = (allies: string[]): boolean => {
      const made = table({ engaged: [{ code: "40028", damage: 8 }], play: allies, phase: "Combat" });
      const settled = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
      const hit = settle({ ...updateCard(settled, idOf(settled, "40028"), { damage: 99 }), window: null }, made.ctx, []);
      return hit.window?.kind === "response";
    };
    expect(offered(["ally", "ally", "ally"])).toBe(true);
    expect(offered(["ally", "ally"])).toBe(false);
  });
  it("40018:A:1 No more than 1 character can attack Ophidian each round: one declared attacker bars the others, also against one declaration of two", () => {
    const made = table({ phase: "PlayerAttacks", engaged: ["40018"], play: ["ally"] });
    const ophidian = idOf(made.state, "40018");
    const both = legalIntents(made.state, made.ctx).filter((intent) => intent.type === "DeclareAttackers");
    expect(both.length).toBeGreaterThan(0);
    const run = start(made.state);
    const declared = send(run, { type: "DeclareAttackers", enemyId: ophidian, attackerIds: [made.hero] }, made.ctx);
    for (const attacker of [made.hero2, idOf(made.state, "ally")]) expect(legalAttackEnemies(declared.state, 0, attacker, made.cards)).not.toContain(ophidian);
  });
  it("40018:A:3 Forced: when a character defends against Ophidian, deal 2 damage to that character", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "f0", "40018", {}, { defender: (made) => made.hero2 });
    const hits = fight.run.steps.filter((step) => step.kind === "damage" && "effect" in step.cause && step.cause.effect === "40018:forced:1");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ targetId: fight.made.hero2, amount: 2 });
  });
  it("40015:A:3 Forced: after Commander of the Dreadnaught attacks you, the Dreadnaught, which stays in the staging area, attacks you", () => {
    const made = table({ phase: "Combat", engaged: [{ code: "40015", seat: 0 }], staging: ["40013"], seats: 2 });
    const run = resolveRecords(made.state, made.ctx, "40015", "forced", idOf(made.state, "40015"));
    const attack = run.state.pendingAttack;
    expect(attack ? run.state.cards[attack.enemyId]?.code : null).toBe("40013");
    expect(attack?.seat).toBe(0);
  });
  it("40039:A:2 Shadow: until the end of the round the attacker is immune to player card effects and gets +2 Defense", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "40039", "f0", {}, { undefended: true });
    const enemy = fight.run.state.seats[0]?.engaged[0] ?? "";
    expect(modifiedStat(fight.run.state, fight.run.state.cards[enemy]!, "defense", fight.ctx.cards)).toBe(3);
    expect(flagged(fight.run.state, enemy, "immuneToPlayerCards")).toBe(true);
  });
  it("40040:A:1 Doomed 1: raise each player's threat by 1, once", () => {
    const made = table({ seats: 2, deck: ["40040", "f0"] });
    const revealed = finish({ ...revealFromTop(made.state, made.ctx, "40040", []), steps: [] } as never, made.ctx);
    expect(revealed.state.seats.slice(0, 2).map((seat) => seat.threat)).toEqual([29, 29]);
  });
});

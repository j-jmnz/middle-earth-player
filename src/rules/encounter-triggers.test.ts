// Rules: rr.step-3-3, rr.active-location, rr.step-6-4b, rr.step-6-4-2, rr.cancel, rr.in-play-and-out-of-play, rr.engaged,
// rr.timing-of-ability-resolution (data/rules/entries.json).
// Triggers and encounter-deck verbs for the A Knife in the Dark lines. The records are fixtures; each test names the ledger
// line (data/printed) it is for.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";

import { effectCause } from "./cause.ts";
import { pushCardEffects } from "./effect-frames.ts";
import { byCode, cardMap, expectOk, hero, idleScenario } from "./fixture.ts";
import type { EngineStep } from "./intents.ts";
import { dealOneShadow } from "./interpret.ts";
import { settle } from "./machine.ts";
import { definePrinted } from "./printed.ts";
import { legalIntents, reduce } from "./reduce.ts";
import { updateCard, withMode, type ScenarioState } from "./state.ts";
import { attachTo, spawn } from "./zones.ts";

const wraith = definePrinted({ code: "wraith", name: "Ringwraith", type: "enemy", traits: ["Nazgûl"], engagementCost: 35, threat: 3, attack: 3, defense: 4, health: 5 });
const orc = definePrinted({ code: "orc", name: "Orc", type: "enemy", engagementCost: 20, threat: 1, attack: 2, defense: 1, health: 3 });
const ferny = definePrinted({ code: "ferny", name: "Bill Ferny", type: "enemy", threat: 1, engagementCost: 50, isUnique: true });
const pony = definePrinted({ code: "pony", name: "The Prancing Pony", type: "location", threat: 1, questPoints: 2, isUnique: true });
const marsh = definePrinted({ code: "marsh", name: "Midgewater", type: "location", threat: 2, questPoints: 3 });
const mist = definePrinted({ code: "mist", name: "Mist", type: "treachery" });
const boost = definePrinted({ code: "boost", name: "Boost", type: "treachery" });
const back = definePrinted({ code: "back", name: "Back Again", type: "treachery" });
const stage = definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 });
const ring = definePrinted({ code: "ring", name: "The One Ring", type: "objective" });
const sword = definePrinted({ code: "sword", name: "Sword", type: "attachment" });
const shield = definePrinted({ code: "shield", name: "Shield", type: "attachment" });
const ward = definePrinted({ code: "ward", name: "Ward", type: "ally", willpower: 1, attack: 0, defense: 0, health: 1 });
const aragorn = hero("aragorn", "leadership");
const sam = hero("sam", "lore");

const cards = cardMap([wraith, orc, ferny, pony, marsh, mist, boost, back, stage, ring, sword, shield, ward, aragorn, sam]);

function record(id: string, cardCode: string, line: string, timing: Effect["timing"], instructions: Instruction[], extra: Partial<Effect> = {}): Effect {
  return { id, cardCode, lines: [line], timing, instructions, ...extra };
}

const boostShadow = record("boost:shadow:1", "boost", "fixture:A:1", "shadow", [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }]);

function seated(seatCount: 1 | 2 = 1): { state: ScenarioState; heroes: string[] } {
  let state = idleScenario(seatCount);
  const placed = spawn(state, "stage", { zone: "questStage" });
  state = placed.state;
  const heroes: string[] = [];
  for (let seat = 0; seat < seatCount; seat += 1) {
    for (const code of ["aragorn", "sam"]) {
      const made = spawn(state, code, { zone: "heroes", seat });
      state = made.state;
      heroes.push(made.id);
    }
  }
  return { state, heroes };
}

describe("a Forced effect at the beginning of the staging step (141051:A:2)", () => {
  const raise = record("ferny:forced:1", "ferny", "141051:A:2", "forced", [{ verb: "RaiseThreat", amount: 1 }], { trigger: "stagingStepBegins" });
  const ctx = { effects: [raise], cards };

  it("resolves once, before the first card of the step is revealed", () => {
    let { state } = seated(2);
    state = spawn(state, "ferny", { zone: "staging" }).state;
    for (const code of ["mist", "mist", "mist"]) state = spawn(state, code, { zone: "encounterDeck" }).state;
    const steps: EngineStep[] = [];
    const staged = settle({ ...withMode(state, "staging"), boundaryPhase: "Quest" }, ctx, steps);
    // Two players reveal two cards; the quest resolution after them raises threat again, which is not this effect.
    const order = steps.flatMap((step) => (step.kind === "threat" || step.kind === "reveal" ? [step.kind] : []));
    expect(order.slice(0, 3)).toEqual(["threat", "reveal", "reveal"]);
    expect(steps.filter((step) => step.kind === "threat" && "effect" in step.cause)).toHaveLength(1);
    expect(steps.find((step) => step.kind === "threat")).toEqual({ kind: "threat", seat: 0, amount: 1, cause: effectCause(raise) });
    expect(staged.mode).not.toBe("staging");
  });
});

describe("a Forced effect after a location becomes the active location (141048:A:2)", () => {
  const forced = record("marsh:forced:1", "marsh", "141048:A:2", "forced", [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }], { trigger: "becameActive" });
  const ctx = { effects: [forced], cards };

  it("resolves when the players travel there", () => {
    let { state } = seated(2);
    const location = spawn(state, "marsh", { zone: "staging" });
    state = spawn(location.state, "orc", { zone: "engaged", seat: 0 }).state;
    state = spawn(state, "wraith", { zone: "engaged", seat: 1 }).state;
    const travel = { ...withMode(state, "travel"), boundaryPhase: "Travel" as const, window: { kind: "travel" as const } };
    const done = expectOk(reduce(travel, { type: "Travel", locationId: location.id }, ctx)).state;
    expect(done.activeLocation).toBe(location.id);
    expect(done.seats[0].engaged).toEqual([]);
    expect(done.seats[1].engaged).toEqual([]);
    expect(done.staging.map((id) => done.cards[id]?.code).sort()).toEqual(["orc", "wraith"]);
  });
});

describe("a Forced effect after this location leaves play (141045:A:2)", () => {
  const forced = record("pony:forced:1", "pony", "141045:A:2", "forced", [{ verb: "DiscardUntilEnemies", perPlayer: 1 }], { trigger: "leftPlay" });
  const ctx = { effects: [forced], cards };

  it("is heard by the location after it was explored, and puts X discarded enemies into play engaged with the first player", () => {
    let { state, heroes } = seated(2);
    const location = spawn(state, "pony", { zone: "activeLocation" });
    state = location.state;
    for (const code of ["mist", "orc", "mist", "wraith", "orc"]) state = spawn(state, code, { zone: "encounterDeck" }).state;
    for (const id of heroes) state = updateCard(state, id, { committed: true });
    const steps: EngineStep[] = [];
    // 4 willpower against no threat: the Pony (2 points) is explored and leaves play.
    const resolved = settle({ ...withMode({ ...state, firstPlayer: 1 }, "resolution"), boundaryPhase: "Quest" }, ctx, steps);
    expect(resolved.cards[location.id]?.zone).toBe("encounterDiscard");
    // Two players: cards come off until two enemies are among them.
    expect(resolved.encounterDeck.map((id) => resolved.cards[id]?.code)).toEqual(["orc"]);
    expect(resolved.seats[1].engaged.map((id) => resolved.cards[id]?.code)).toEqual(["orc", "wraith"]);
    expect(resolved.encounterDiscard.map((id) => resolved.cards[id]?.code)).toEqual(["pony", "mist", "mist"]);
    expect(steps.filter((step) => step.kind === "engage")).toHaveLength(2);
  });

  it("stops when the encounter deck is empty", () => {
    let { state } = seated(1);
    const location = spawn(state, "pony", { zone: "encounterDiscard" });
    state = spawn(location.state, "mist", { zone: "encounterDeck" }).state;
    const done = settle(pushCardEffects(state, "forced", location.id, 0, false, [forced], ctx, []), ctx, []);
    expect(done.encounterDeck).toEqual([]);
    expect(done.seats[0].engaged).toEqual([]);
  });
});

describe("a Forced effect when an enemy attacks deals it an additional shadow card (141069:A:2)", () => {
  const forced = record("wraith:forced:1", "wraith", "141069:A:2", "forced", [{ verb: "DealShadow", additional: true }], {
    trigger: "attacks",
    condition: { kind: "exhausted", code: "ring", is: true },
  });

  function attackTable(ringExhausted: boolean): { state: ScenarioState; enemy: string; defender: string } {
    let { state, heroes } = seated(1);
    const theRing = spawn(state, "ring", { zone: "play", seat: 0 });
    state = attachTo(updateCard(theRing.state, theRing.id, { exhausted: ringExhausted }), theRing.id, heroes[0] ?? "");
    const enemy = spawn(state, "wraith", { zone: "engaged", seat: 0 });
    state = enemy.state;
    for (const code of ["boost", "boost", "mist"]) state = spawn(state, code, { zone: "encounterDeck" }, "down").state;
    state = dealOneShadow(state, enemy.id);
    return { state: { ...withMode(state, "enemyAttacks"), boundaryPhase: "Combat" }, enemy: enemy.id, defender: heroes[1] ?? "" };
  }

  it("deals it before the defender is declared, and resolves every shadow card dealt to the attacker (rr.step-6-4-2)", () => {
    const ctx = { effects: [forced, boostShadow], cards };
    const { state, enemy, defender } = attackTable(true);
    const asked = settle(state, ctx, []);
    expect(asked.window).toEqual({ kind: "defense", enemyId: enemy, seat: 0 });
    const shadows = [asked.cards[enemy]?.shadowId, ...(asked.cards[enemy]?.extraShadowIds ?? [])];
    expect(shadows.map((id) => asked.cards[id ?? ""]?.code)).toEqual(["boost", "boost"]);
    const done = expectOk(reduce(asked, { type: "DeclareDefender", defenderId: defender }, ctx));
    // Attack 3 + 1 + 1 against defense 1.
    expect(done.steps.filter((step) => step.kind === "damage")).toEqual([{ kind: "damage", targetId: defender, amount: 4, cause: { rule: "rr.step-6-4-3" } }]);
    expect(done.state.encounterDiscard.map((id) => done.state.cards[id]?.code)).toEqual(["boost", "boost"]);
    expect(done.state.cards[enemy]?.extraShadowIds).toBeUndefined();
  });

  it("deals nothing extra while its condition does not hold", () => {
    const ctx = { effects: [forced, boostShadow], cards };
    const { state, enemy } = attackTable(false);
    const asked = settle(state, ctx, []);
    expect(asked.cards[enemy]?.extraShadowIds).toBeUndefined();
    expect(asked.encounterDeck).toHaveLength(2);
  });

  it("offers the cancel Responses for the additional shadow card too (rr.cancel)", () => {
    const cancel = record("ward:response:1", "ward", "fixture:A:1", "response", [{ verb: "CancelEffect" }], { trigger: "shadowPending" });
    const ctx = { effects: [forced, boostShadow, cancel], cards };
    const { state: base, defender } = attackTable(true);
    const state = spawn(base, "ward", { zone: "play", seat: 0 }).state;
    const wardId = byCode(state, "ward")[0] ?? "";
    let current = expectOk(reduce(settle(state, ctx, []), { type: "DeclareDefender", defenderId: defender }, ctx)).state;
    // The first shadow card: pass. The additional one: cancel it.
    expect(current.window).toEqual({ kind: "response", seat: 0 });
    current = expectOk(reduce(current, { type: "Pass" }, ctx)).state;
    expect(current.window).toEqual({ kind: "response", seat: 0 });
    const done = expectOk(reduce(current, { type: "Trigger", cardId: wardId, effectId: cancel.id }, ctx));
    expect(done.steps.filter((step) => step.kind === "damage").map((step) => (step.kind === "damage" ? step.amount : 0))).toEqual([3]);
    expect(done.state.encounterDiscard.map((id) => done.state.cards[id]?.code)).toEqual(["boost", "boost"]);
  });
});

describe("shadow verbs", () => {
  function attacked(shadowCode: string, effects: Effect[], setup: (state: ScenarioState) => ScenarioState = (state) => state) {
    let { state, heroes } = seated(1);
    const enemy = spawn(state, "orc", { zone: "engaged", seat: 0 });
    state = spawn(enemy.state, shadowCode, { zone: "encounterDeck" }, "down").state;
    state = spawn(state, "mist", { zone: "encounterDeck" }, "down").state;
    state = setup(dealOneShadow(state, enemy.id));
    const ctx = { effects, cards };
    const asked = settle({ ...withMode(state, "enemyAttacks"), boundaryPhase: "Combat" }, ctx, []);
    return { asked, ctx, enemy: enemy.id, defender: heroes[1] ?? "", heroes };
  }

  it("shuffles the shadow card into the encounter deck instead of discarding it (141069:A:3)", () => {
    const shuffle = record("back:shadow:1", "back", "141069:A:3", "shadow", [{ verb: "ShuffleSelfIntoEncounterDeck" }]);
    const { asked, ctx, defender } = attacked("back", [shuffle]);
    const done = expectOk(reduce(asked, { type: "DeclareDefender", defenderId: defender }, ctx)).state;
    expect(done.encounterDeck.map((id) => done.cards[id]?.code).sort()).toEqual(["back", "mist"]);
    expect(done.encounterDiscard).toEqual([]);
    expect(done.cards[byCode(done, "back")[0] ?? ""]?.face).toBe("down");
  });

  it("makes the defending player discard a card at random, chosen by the seed (141047:A:2)", () => {
    const random = record("back:shadow:1", "back", "141047:A:2", "shadow", [{ verb: "DiscardRandomFromHand" }]);
    const { asked, ctx, defender } = attacked("back", [random], (state) => {
      let next = state;
      for (const code of ["sword", "shield", "ward"]) next = spawn(next, code, { zone: "hand", seat: 0 }).state;
      return next;
    });
    const done = expectOk(reduce(asked, { type: "DeclareDefender", defenderId: defender }, ctx)).state;
    expect(done.seats[0].hand).toHaveLength(2);
    expect(done.seats[0].discard).toHaveLength(1);
    expect(done.seedCursor).toBe(asked.seedCursor + 1);
    // The same seed and cursor discard the same card.
    const again = expectOk(reduce(asked, { type: "DeclareDefender", defenderId: defender }, ctx)).state;
    expect(again.seats[0].discard).toEqual(done.seats[0].discard);
  });

  it("asks the defending player to choose when a shadow effect picks (141071:A:2), and the attack goes on after", () => {
    const discard = record("back:shadow:1", "back", "141071:A:2", "shadow", [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "DiscardPicked" }]);
    let swordId = "";
    let shieldId = "";
    const { asked, ctx, defender } = attacked("back", [discard], (state) => {
      const host = state.seats[0].heroes[0] ?? "";
      const a = spawn(state, "sword", { zone: "play", seat: 0 });
      const b = spawn(a.state, "shield", { zone: "play", seat: 0 });
      const r = spawn(b.state, "ring", { zone: "play", seat: 0 });
      swordId = a.id;
      shieldId = b.id;
      return attachTo(attachTo(attachTo(r.state, a.id, host), b.id, host), r.id, host);
    });
    const choosing = expectOk(reduce(asked, { type: "DeclareDefender", defenderId: defender }, ctx));
    // The One Ring is an objective, not an attachment: it is not offered.
    expect(choosing.state.window).toEqual({ kind: "choose", seat: 0, options: [swordId, shieldId] });
    expect(choosing.steps.some((step) => step.kind === "damage")).toBe(false);
    expect(legalIntents(choosing.state, ctx)).toEqual([{ type: "Choose", optionId: swordId }, { type: "Choose", optionId: shieldId }]);
    const done = expectOk(reduce(choosing.state, { type: "Choose", optionId: shieldId }, ctx));
    expect(done.state.cards[shieldId]?.zone).toBe("discard");
    expect(done.state.cards[swordId]?.zone).toBe("play");
    expect(done.steps.filter((step) => step.kind === "damage").map((step) => (step.kind === "damage" ? step.amount : 0))).toEqual([1]);
    expect(done.state.pendingAttack).toBeNull();
    expect(done.state.encounterDiscard.map((id) => done.state.cards[id]?.code)).toEqual(["back"]);
  });
});

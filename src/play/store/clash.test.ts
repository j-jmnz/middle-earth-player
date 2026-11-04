import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { shadowCards } from "../../rules/core/zones.ts";
import { hero, seaTable, send, ship, shipEnemy, until } from "../../rules/families/sea/table.ts";
import { attackOrPolicy, playUntil, type Reduced } from "../../../test/harness/combat-policy.ts";
import { starterStart, starterWorld } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { clashesOf, type Clash } from "./clash.ts";

// Rules: rr.step-6-4-3, rr.step-6-8b, rr.step-6-8-3, ltp.shadow-discard (data/rules/entries.json). The attacks of a new state for the
// combat spotlight, read from the engine's steps in whole starter games played the way src/campaign/combat-flow.test.ts plays
// them (test/harness/combat-policy.ts): a defended attack, a blocked one, an undefended hero, a defender destroyed, two attackers
// destroying an enemy, a shadow card, and two attacks in one state. Every number is checked against the steps and the states.
const DECK = "stealth-and-steadfastness";
let ctx: ReduceContext;

beforeAll(async () => {
  ctx = (await starterWorld(DECK)).ctx;
});

// The first intent of the seeded game that resolves an attack `wanted` accepts. `keep` heroes are held back from the quest and
// from defense so the seat can attack with that many.
function attackWhere(seed: number, keep: number, wanted: (clash: Clash, reduced: Reduced) => boolean): Reduced {
  const start = expectOk(reduce(startScenario(starterStart(DECK, seed), ctx), { type: "Keep" }, ctx)).state;
  const found = playUntil(ctx, start, keep, (reduced) => clashesOf(reduced.prev, reduced.next, reduced.steps).some((clash) => wanted(clash, reduced)));
  if (!found) throw new Error(`Seed ${seed} never reached that attack`);
  return found;
}

const strikeOf = (reduced: Reduced) => reduced.steps.find((step) => step.kind === "strike");
// Whose attack the reduce resolved, from the engine's own strike step.
const sideOf = (reduced: Reduced) => {
  const strike = strikeOf(reduced);
  return strike?.kind === "strike" ? strike.side : null;
};
const damageOf = (reduced: Reduced, targetId: string) => reduced.steps.find((step) => step.kind === "damage" && step.targetId === targetId);

// The numbers a clash must carry, each read from the engine's own steps.
function expectEngineNumbers(clash: Clash, reduced: Reduced): void {
  const strike = strikeOf(reduced);
  const placed = damageOf(reduced, clash.target);
  if (strike?.kind !== "strike" || placed?.kind !== "damage") throw new Error("The attack left no strike and damage step");
  expect(clash.target).toBe(strike.targetId);
  expect(clash.attack).toBe(strike.attack);
  expect(clash.defense).toBe(strike.defense);
  expect(clash.undefended).toBe(strike.undefended);
  expect(clash.damage).toBe(placed.amount);
  // The state agrees: the target's damage went up by exactly that much (or it left play with it).
  const was = reduced.prev.cards[clash.target]?.damage ?? 0;
  const now = reduced.next.cards[clash.target]?.damage ?? was + clash.damage;
  expect(now - was).toBe(clash.damage);
  expect(clash.destroyed).toBe(reduced.steps.some((step) => step.kind === "destroy" && step.targetId === clash.target));
}

describe("clashesOf", () => {
  it("reads a defended enemy attack with 1 damage", () => {
    const reduced = attackWhere(2, 1, (clash, found) => !clash.undefended && clash.damage === 1 && !clash.destroyed && clash.attackers.length === 1 && sideOf(found) === "enemy");
    const [clash, ...rest] = clashesOf(reduced.prev, reduced.next, reduced.steps);
    expect(rest).toEqual([]);
    expect(clash).toMatchObject({ damage: 1, destroyed: false, undefended: false });
    expect(clash?.attack).toBeGreaterThan(clash?.defense ?? 0);
    // The enemy attacks, the defender is the target.
    const strike = strikeOf(reduced);
    expect(strike?.kind === "strike" && strike.side).toBe("enemy");
    expect(clash?.attackers).toEqual([strike?.kind === "strike" ? strike.enemyId : ""]);
    expectEngineNumbers(clash as Clash, reduced);
  });

  it("reads a blocked attack as 0 damage, with the defense that blocked it", () => {
    const reduced = attackWhere(18, 1, (clash, found) => !clash.undefended && clash.damage === 0 && clash.attack > 0 && sideOf(found) === "enemy");
    const [clash] = clashesOf(reduced.prev, reduced.next, reduced.steps);
    expect(clash).toMatchObject({ damage: 0, destroyed: false });
    expect(clash?.defense).toBeGreaterThanOrEqual(clash?.attack ?? 0);
    expectEngineNumbers(clash as Clash, reduced);
    // The engine placed a damage step of 0 for it: a blocked attack is still an attack with a damage step.
    expect(damageOf(reduced, clash?.target ?? "")).toMatchObject({ amount: 0 });
  });

  it("reads an undefended attack on a hero: the whole attack, no defense", () => {
    const reduced = attackWhere(9, 1, (clash) => clash.undefended && clash.damage > 0 && !clash.destroyed);
    const [clash] = clashesOf(reduced.prev, reduced.next, reduced.steps);
    expect(clash).toMatchObject({ undefended: true, defense: 0, destroyed: false });
    expect(clash?.damage).toBe(clash?.attack);
    expect(reduced.prev.cards[clash?.target ?? ""]?.zone).toBe("heroes");
    expectEngineNumbers(clash as Clash, reduced);
  });

  it("reads a defender destroyed by the attack", () => {
    const reduced = attackWhere(1, 1, (clash, found) => !clash.undefended && clash.destroyed && sideOf(found) === "enemy");
    const [clash] = clashesOf(reduced.prev, reduced.next, reduced.steps);
    expect(clash?.destroyed).toBe(true);
    expect(clash?.damage).toBeGreaterThan(0);
    expect(reduced.next.cards[clash?.target ?? ""]?.zone).not.toBe(reduced.prev.cards[clash?.target ?? ""]?.zone);
    expectEngineNumbers(clash as Clash, reduced);
  });

  it("reads the players' attack with two attackers destroying an enemy", () => {
    const reduced = attackWhere(115, 2, (clash, found) => clash.attackers.length === 2 && clash.destroyed && sideOf(found) === "player");
    const [clash] = clashesOf(reduced.prev, reduced.next, reduced.steps);
    const strike = strikeOf(reduced);
    expect(strike?.kind === "strike" && strike.side).toBe("player");
    // The attackers are the ones the engine's attack step names, and the target is the enemy they attacked.
    const declared = reduced.steps.find((step) => step.kind === "attack");
    expect(declared?.kind === "attack" && declared.attackerIds).toEqual(clash?.attackers);
    expect(clash?.attackers).toHaveLength(2);
    expect(clash?.target).toBe(strike?.kind === "strike" ? strike.enemyId : "");
    expect(clash).toMatchObject({ destroyed: true, undefended: false, shadow: null });
    expect(clash?.attack).toBeGreaterThan(clash?.defense ?? 99);
    expect(reduced.prev.cards[clash?.target ?? ""]?.zone).toBe("engaged");
    expectEngineNumbers(clash as Clash, reduced);
  });

  it("reads the attackers of a players' attack resolved in the reduce that declared it", () => {
    const reduced = attackWhere(121, 2, (clash, found) => found.intent.type === "DeclareAttackers" && clash.attackers.length === 2);
    const [clash] = clashesOf(reduced.prev, reduced.next, reduced.steps);
    expect(reduced.intent.type === "DeclareAttackers" && reduced.intent.attackerIds).toEqual(clash?.attackers);
    expect(reduced.prev.pendingStrike).toBeNull();
  });

  it("reads the shadow card an enemy's attack turned face up", () => {
    const reduced = attackWhere(1, 1, (clash) => clash.shadow != null);
    const [clash] = clashesOf(reduced.prev, reduced.next, reduced.steps);
    const enemy = clash?.attackers[0] ?? "";
    expect(shadowCards(reduced.prev.cards[enemy])).toContain(clash?.shadow);
    // Face up beside the enemy, or already in the discard pile when it was the last attack of the combat phase.
    const turned = reduced.next.cards[clash?.shadow ?? ""];
    expect(turned && (turned.zone !== "shadow" || turned.face === "up")).toBe(true);
    expectEngineNumbers(clash as Clash, reduced);
  });

  it("leaves a shadow card the attack did not turn down, and gives the players' attack none", () => {
    const reduced = attackWhere(1, 1, (clash) => clash.shadow != null);
    const id = clashesOf(reduced.prev, reduced.next, reduced.steps)[0]?.shadow ?? "";
    const card = reduced.next.cards[id];
    if (!card) throw new Error("The shadow card is gone");
    // The same attack, with its enemy's shadow card still face down in the shadow zone afterwards: nothing was turned.
    const stillDown: ScenarioState = { ...reduced.next, cards: { ...reduced.next.cards, [id]: { ...card, zone: "shadow", face: "down" } } };
    expect(clashesOf(reduced.prev, stillDown, reduced.steps)[0]?.shadow).toBeNull();
    const players = attackWhere(7, 1, (_, found) => sideOf(found) === "player");
    expect(clashesOf(players.prev, players.next, players.steps)[0]?.shadow).toBeNull();
  });

  it("reads two attacks in one state, in order", () => {
    // The table's store reports one reduce at a time; a Pass through several windows (stops) can resolve two attacks in one, which
    // is what the steps of two consecutive reduces joined look like.
    let state = expectOk(reduce(startScenario(starterStart(DECK, 2), ctx), { type: "Keep" }, ctx)).state;
    const start: ScenarioState[] = [];
    const steps: EngineStep[] = [];
    let end = state;
    for (let turn = 0; turn < 900 && start.length < 2 && !state.lost; turn += 1) {
      const result = expectOk(reduce(state, attackOrPolicy(state, ctx, 1), ctx));
      if (result.steps.some((step) => step.kind === "strike")) {
        start.push(state);
        steps.push(...result.steps);
        end = result.state;
      }
      state = result.state;
    }
    const first = start[0];
    expect(start).toHaveLength(2);
    if (!first) return;
    const clashes = clashesOf(first, end, steps);
    const strikes = steps.flatMap((step) => (step.kind === "strike" ? [step] : []));
    expect(clashes).toHaveLength(2);
    // In the order the strikes came, each with its own numbers.
    expect(clashes.map((clash) => clash.target)).toEqual(strikes.map((strike) => strike.targetId));
    expect(clashes.map((clash) => [clash.attack, clash.defense])).toEqual(strikes.map((strike) => [strike.attack, strike.defense]));
    const damages = strikes.map((strike) => steps.find((step, index) => step.kind === "damage" && step.targetId === strike.targetId && index > steps.indexOf(strike)));
    expect(clashes.map((clash) => clash.damage)).toEqual(damages.map((step) => (step?.kind === "damage" ? step.amount : -1)));
  });
});

describe("what gets no spotlight", () => {
  it("gives none to archery or to damage from a card effect: damage with no strike before it", () => {
    const reduced = attackWhere(2, 1, () => true);
    const damage = reduced.steps.find((step) => step.kind === "damage");
    if (damage?.kind !== "damage") throw new Error("No damage step");
    const archery: EngineStep[] = [{ kind: "damage", targetId: damage.targetId, amount: 2, cause: ruleCause("mec109.archery") }];
    expect(clashesOf(reduced.prev, reduced.next, archery)).toEqual([]);
    expect(clashesOf(reduced.prev, reduced.next, [{ kind: "attack", side: "enemy", seat: 0, enemyId: damage.targetId }, ...archery])).toEqual([]);
  });

  it("gives none to an attack that was canceled or ended without a damage step", () => {
    const reduced = attackWhere(2, 1, () => true);
    const strike = strikeOf(reduced);
    if (strike?.kind !== "strike") throw new Error("No strike");
    expect(clashesOf(reduced.prev, reduced.next, [{ kind: "attack", side: "enemy", seat: 0, enemyId: strike.enemyId }])).toEqual([]);
    // A strike whose damage the engine did not place (a card said the target takes none): no damage step, no spotlight.
    const withoutDamage = reduced.steps.filter((step) => step.kind !== "damage");
    expect(withoutDamage.some((step) => step.kind === "strike")).toBe(true);
    expect(clashesOf(reduced.prev, reduced.next, withoutDamage)).toEqual([]);
    // Damage on another card is not this attack's damage.
    const elsewhere = reduced.steps.map((step) => (step.kind === "damage" ? { ...step, targetId: `${step.targetId}-elsewhere` } : step));
    expect(clashesOf(reduced.prev, reduced.next, elsewhere)).toEqual([]);
  });

  it("agrees with the engine over whole games: one clash for each strike with its damage, none for a reduce without one", () => {
    for (const seed of [1, 9]) {
      let state = expectOk(reduce(startScenario(starterStart(DECK, seed), ctx), { type: "Keep" }, ctx)).state;
      let clashes = 0;
      let strikes = 0;
      for (let turn = 0; turn < 900 && !state.lost && !state.stageCleared; turn += 1) {
        const result = expectOk(reduce(state, attackOrPolicy(state, ctx, 1), ctx));
        const found = clashesOf(state, result.state, result.steps);
        const here = result.steps.filter((step) => step.kind === "strike").length;
        // Every strike here is followed by the damage step of its target, so each is a clash; a reduce without one has none.
        expect(found.length, `seed ${seed} turn ${turn}`).toBe(here);
        clashes += found.length;
        strikes += here;
        state = result.state;
      }
      expect(strikes).toBeGreaterThan(2);
      expect(clashes).toBe(strikes);
    }
  });
});

// Rules: dcce.ship-enemies, dcce.ship-objectives (data/rules/entries.json). The spotlight between ships (docs/design-system-table.md, Cards) is nothing new: a ship defending
// against a ship-enemy, an undefended hit on a ship, and ships with heroes attacking a ship-enemy are clashes like any other, read from the engine's steps.
describe("clashesOf at sea", () => {
  const seaCards = () => [hero("aragorn"), ship("dc", "Dream-chaser", { attack: 4, defense: 4 }), ship("ds", "Dawn Star"), shipEnemy("corsair", { attack: 5, health: 12 })];

  function defenseWindow(spec: Partial<Parameters<typeof seaTable>[0]> = {}) {
    const built = seaTable({ cards: seaCards(), effects: [], heroes: [{ code: "aragorn" }], allies: [{ code: "dc" }, { code: "ds" }], enemies: [{ code: "corsair" }], ...spec });
    return { ...built, state: until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense") };
  }

  it("reads a ship defending against a ship-enemy: the enemy attacks, the ship is the target with its own defense", () => {
    const { state, ids, ctx } = defenseWindow();
    const result = expectOk(reduce(state, { type: "DeclareDefender", defenderId: ids.dc! }, ctx));
    const [clash, ...rest] = clashesOf(state, result.state, result.steps);
    expect(rest).toEqual([]);
    expect(clash).toMatchObject({ attackers: [ids.corsair], target: ids.dc, attack: 5, defense: 4, damage: 1, undefended: false, destroyed: false });
  });

  it("reads an undefended ship-enemy's hit on a ship, the whole attack as damage", () => {
    const { state, ids, ctx } = defenseWindow();
    const result = expectOk(reduce(state, { type: "Undefended", heroId: ids.ds! }, ctx));
    const [clash] = clashesOf(state, result.state, result.steps);
    expect(clash).toMatchObject({ attackers: [ids.corsair], target: ids.ds, attack: 5, damage: 5, undefended: true });
  });

  it("reads ships and heroes attacking a ship-enemy together as one clash with every attacker", () => {
    const built = seaTable({ cards: seaCards(), effects: [], heroes: [{ code: "aragorn" }], allies: [{ code: "dc" }, { code: "ds" }], enemies: [{ code: "corsair" }] });
    const state = { ...built.state, phase: "Combat" as const, mode: "playerAttacks" as const, window: { kind: "playerAttack" as const }, boundaryPhase: "Combat" as const };
    const result = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: built.ids.corsair!, attackerIds: [built.ids.dc!, built.ids.aragorn!, built.ids.ds!] }, built.ctx));
    const [clash] = clashesOf(state, result.state, result.steps);
    expect(clash?.target).toBe(built.ids.corsair);
    expect([...(clash?.attackers ?? [])].sort()).toEqual([built.ids.dc, built.ids.aragorn, built.ids.ds].sort());
    expect(clash?.defense).toBe(1);
    // 4 + 2 + 3 against 1 Defense.
    expect(clash?.damage).toBe(clash?.attack === undefined ? -1 : clash.attack - 1);
  });
});

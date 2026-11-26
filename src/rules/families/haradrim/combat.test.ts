// Rules: rr.step-6-4-1, rr.step-6-4-3, rr.defending-player, rr.modifiers, ltp.undefended-attack, hrd.heroes-in-the-staging-area (data/rules/entries.json); ledger lines 16062:A:1, 16062:A:2, 16063:A:1, 16065:A:2, 16071:B:1, 16072:B:1. The haradrim family's combat hooks on their own: the damage of an undefended
// attack that goes to the heroes in the staging area, the allies an Uruk of Mordor bars, and the Threat of an attacker against the Willpower of its defending character.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { fight, idOf, legalTargets, opened, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { send } from "../../../../test/harness/scene.ts";
import { holds } from "../../interpret/conditions.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { allyBelowThreat, threatAboveWillpower, willpowerGap } from "./combat.ts";
import { stagedHeroes } from "./staged.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-long-arm-of-mordor", { seats: 1, stage: "16071", phase: "Combat", ...layout });
const URUK = "16062";
const RIDER = "16063";
const defenseWindow = (state: ScenarioState): boolean => state.window?.kind === "defense";

// The table at the defense window of the enemy's attack, with the heroes of the first seat moved to the staging area when `staged`.
function attacked(layout: Layout, staged: boolean) {
  const made = table(layout);
  const state = staged ? runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" }) : opened(made).state;
  const arrived = fight(made, opened(made, state), defenseWindow);
  return { made, run: arrived, state: arrived.state };
}

describe("16071:B:1 an undefended attack's damage goes to a hero in the staging area", () => {
  it("the attacked player is offered the heroes in the staging area, and the whole attack lands on the one named, no Defense taken off", () => {
    const { made, run, state } = attacked({ engaged: [URUK] }, true);
    const staged = stagedHeroes(state).map((card) => card.id);
    expect(state.window?.kind).toBe("defense");
    const offered = legalTargets(state, { type: "Undefended" }, made.ctx);
    expect([...offered].sort()).toEqual([...staged].sort());
    const target = staged[1] ?? "";
    const done = fight(made, run, (current) => current.pendingAttack == null, { heroCode: state.cards[target]?.code ?? "" });
    expect(done.state.cards[target]?.damage).toBe(4);
    expect(done.state.cards[staged[0] ?? ""]?.damage).toBe(0);
  });

  it("with no hero in the staging area the damage goes to a hero the player controls, as the rules read", () => {
    const { made, state } = attacked({ engaged: [URUK] }, false);
    const offered = legalTargets(state, { type: "Undefended" }, made.ctx);
    expect([...offered].sort()).toEqual([...(state.seats[0]?.heroes ?? [])].sort());
  });

  it("the stage that does not hold the flag leaves the heroes in the staging area out of it", () => {
    const { made, state } = attacked({ engaged: [URUK], stage: "16073" }, true);
    expect(legalTargets(state, { type: "Undefended" }, made.ctx)).toEqual([]);
  });

  it("a staged hero reduced to 0 hit points by an undefended attack is destroyed and goes to its owner's discard pile", () => {
    const { made, run, state } = attacked({ engaged: [{ code: URUK }], heroes: [] }, true);
    const target = stagedHeroes(state)[0]?.id ?? "";
    const hurt = { ...state, cards: { ...state.cards, [target]: { ...state.cards[target]!, damage: 9 } } };
    const done = fight(made, { ...run, state: hurt }, (current) => current.pendingAttack == null, { heroCode: state.cards[target]?.code ?? "" });
    expect(done.state.cards[target]?.zone).toBe("discard");
    expect(done.state.seats[0]?.discard).toContain(target);
  });
});

describe("16062:A:1 an ally with less Willpower than the Uruk of Mordor's Threat cannot defend against it", () => {
  const reasonFor = (willpower: number, threat?: number): string | null => {
    const made = table({ engaged: [URUK], play: ["ally"] });
    const uruk = idOf(made.state, URUK);
    const ally = idOf(made.state, "ally");
    const state: ScenarioState = {
      ...opened(made).state,
      pendingAttack: { enemyId: uruk, seat: 0 },
      modifiers: [...opened(made).state.modifiers, { instanceId: ally, sourceId: "t", stat: "willpower", amount: willpower - modifiedStat(opened(made).state, opened(made).state.cards[ally]!, "willpower", made.cards), until: "endOfGame" }, ...(threat != null ? [{ instanceId: uruk, sourceId: "t", stat: "threat" as const, amount: threat - modifiedStat(opened(made).state, opened(made).state.cards[uruk]!, "threat", made.cards), until: "endOfGame" as const }] : [])],
    };
    return allyBelowThreat(state, made.cards.get("ally")!, made.cards, ally);
  };

  it("an ally below its Threat is barred, one at or above it is not, and the Threat is the current one (guarding adds 1)", () => {
    const base = 2;
    expect(reasonFor(1)).toMatch(/cannot defend/);
    expect(reasonFor(base)).toBeNull();
    expect(reasonFor(base + 1)).toBeNull();
    expect(reasonFor(2, base + 1)).toMatch(/cannot defend/);
  });

  it("a hero is never barred, and the bar reads only the enemy that holds the flag", () => {
    const made = table({ engaged: [URUK, RIDER] });
    const state = { ...opened(made).state, pendingAttack: { enemyId: idOf(made.state, RIDER), seat: 0 } };
    const hero = made.state.seats[0]?.heroes[0] ?? "";
    expect(allyBelowThreat(state, made.cards.get(made.state.cards[hero]!.code)!, made.cards, hero)).toBeNull();
    const ally = table({ engaged: [URUK, RIDER], play: ["ally"] });
    const aid = idOf(ally.state, "ally");
    const byRider = { ...opened(ally).state, pendingAttack: { enemyId: idOf(ally.state, RIDER), seat: 0 } };
    expect(allyBelowThreat(byRider, ally.cards.get("ally")!, ally.cards, aid)).toBeNull();
  });
});

describe("16062:A:2 16065:A:2 16063:A:1 the attacker's Threat against the defending character's Willpower", () => {
  // The attack in progress by `code`, with a defending character of `willpower` (a hero stand-in with a Willpower modifier), or none.
  function against(code: string, willpower: number | null) {
    const made = table({ engaged: [code] });
    const state0 = opened(made).state;
    const enemy = idOf(state0, code);
    const hero = state0.seats[0]?.heroes[0] ?? "";
    const delta = willpower == null ? 0 : willpower - modifiedStat(state0, state0.cards[hero]!, "willpower", made.cards);
    const state: ScenarioState = {
      ...state0,
      pendingAttack: { enemyId: enemy, seat: 0, ...(willpower == null ? { undefended: true } : { defenderId: hero }) },
      modifiers: [...state0.modifiers, { instanceId: hero, sourceId: "t", stat: "willpower", amount: delta, until: "endOfGame" }],
    };
    return { made, state, enemy };
  }

  it("16062:A:2 the condition holds when the Threat is greater than the Willpower, and not when it is equal, lower or the attack is undefended", () => {
    const threat = 2;
    expect(threatAboveWillpower(against(URUK, threat - 1).state, against(URUK, 1).made.cards)).toBe(true);
    for (const will of [threat, threat + 1]) expect(threatAboveWillpower(against(URUK, will).state, against(URUK, will).made.cards)).toBe(false);
    const none = against(URUK, null);
    expect(threatAboveWillpower(none.state, none.made.cards)).toBe(false);
    const read = against(URUK, 0);
    expect(holds(read.state, { kind: "threatAboveWillpower" }, { actor: 0, sourceId: read.enemy, returned: 0 }, read.made.ctx)).toBe(true);
  });

  it("16063:A:1 the gap is the Threat less the Willpower, 0 for an enemy that is not the attacker, an equal or higher Willpower and an undefended attack", () => {
    const threat = 3;
    const a = against(RIDER, 1);
    expect(willpowerGap(a.state, a.enemy, a.made.cards)).toBe(threat - 1);
    expect(resolveAmount(a.state, { willpowerGap: true }, { actor: 0, sourceId: a.enemy }, a.made.ctx)).toBe(threat - 1);
    const equal = against(RIDER, threat);
    expect(willpowerGap(equal.state, equal.enemy, equal.made.cards)).toBe(0);
    const none = against(RIDER, null);
    expect(willpowerGap(none.state, none.enemy, none.made.cards)).toBe(0);
    expect(willpowerGap(a.state, "elsewhere", a.made.cards)).toBe(0);
    const idle = table({ engaged: [RIDER] });
    expect(willpowerGap(opened(idle).state, idOf(idle.state, RIDER), idle.cards)).toBe(0);
  });

  it("16063:A:1 the Warg-rider's constant gives +X Attack once the defender is declared, with the table synced", () => {
    const a = against(RIDER, 1);
    const synced = opened(a.made, a.state).state;
    expect(modifiedStat(synced, synced.cards[a.enemy]!, "attack", a.made.cards)).toBe(3 + 2);
    const none = against(RIDER, null);
    const noneSynced = opened(none.made, none.state).state;
    expect(modifiedStat(noneSynced, noneSynced.cards[none.enemy]!, "attack", none.made.cards)).toBe(3);
  });
});

void send;
void ({} as EngineStep);

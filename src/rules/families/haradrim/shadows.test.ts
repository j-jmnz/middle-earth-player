// Rules: rr.shadow-effects, rr.engaged, rr.destroy, hrd.orcs-area-different-stage (data/rules/entries.json); ledger lines 17042:A:2, 17043:A:2, 17045:A:3, 17046:A:2. The shadow cards of Race Across Harad played in an attack: the enemy that moves to the Orcs' area after the attack,
// Uruk Pursuer that comes into play engaged, Pursuers from Mordor's progress for a destroyed character and Howling at their Heels' threat.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
import { fightEnemy, idOf, opened, run as runInstruction, type FightOptions, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { ORCS_STAGES, CHIEFTAIN, raceTable, URUK } from "./race-kit.ts";

const table = (layout: Layout = {}): LayoutTable => raceTable({ setAside: [...ORCS_STAGES, CHIEFTAIN], ...layout });
const prepare = (state: ScenarioState, made: LayoutTable): ScenarioState => runInstruction(made, opened(made, state).state, { verb: "PrepareOrcsArea", stages: ORCS_STAGES, number: 1, place: [CHIEFTAIN] });
const options = (extra: FightOptions<LayoutTable> = {}): FightOptions<LayoutTable> => ({ tweak: prepare, ...extra });

describe("17042:A:2 Harad Road's shadow moves the attacking enemy to the Orcs' area after the attack at another stage", () => {
  it("at another stage the attacker leaves the attack and stands in the Orcs' area, no longer engaged", () => {
    const fought = fightEnemy(table, "17042", URUK, { stage: "17048" }, options());
    const uruk = idOf(fought.run.state, URUK);
    expect(fought.run.state.cards[uruk]?.zone).toBe("orcsArea");
    expect(fought.run.state.seats[0]?.engaged ?? []).not.toContain(uruk);
    expect(fought.run.state.orcs?.members).toContain(uruk);
  });

  it("at the same stage nothing moves: the attacker stays engaged", () => {
    const fought = fightEnemy(table, "17042", URUK, { stage: "17047" }, options());
    expect(fought.run.state.cards[idOf(fought.run.state, URUK)]?.zone).toBe("engaged");
  });

  it("an attacker that is no longer in play when the shadow's instruction runs is not moved: it stays in the discard pile", () => {
    const made = table({ stage: "17048" });
    const state = prepare(made.state, made);
    const uruk = spawn(state, URUK, { zone: "encounterDiscard" });
    const done = runInstruction(made, uruk.state, { verb: "MoveToOrcsArea" }, { sourceId: uruk.id });
    expect(done.cards[uruk.id]?.zone).toBe("encounterDiscard");
    expect(done.orcs?.members).not.toContain(uruk.id);
  });});

describe("17043:A:2 Uruk Pursuer's shadow comes into play engaged with the defending player at another stage", () => {
  it("at another stage the Pursuer is engaged with the defending player after the shadow resolves, and the attacker stays", () => {
    const fought = fightEnemy(table, "17043", URUK, { stage: "17048" }, options());
    const state = fought.run.state;
    expect(state.cards[idOf(state, "17043")]?.zone).toBe("engaged");
    expect(state.cards[idOf(state, "17043")]?.controller).toBe(0);
    expect(state.cards[idOf(state, URUK)]?.zone).toBe("engaged");
  });

  it("the Pursuer put into play engaged by its shadow makes no attack in that combat phase", () => {
    const state = fightEnemy(table, "17043", URUK, { stage: "17048" }, options()).run.state;
    expect(state.resolvedAttacks).toContain(idOf(state, "17043"));
    expect(state.pendingAttack).toBeNull();
  });

  it("at the same stage the shadow card does nothing and is discarded", () => {
    const fought = fightEnemy(table, "17043", URUK, { stage: "17047" }, options());
    expect(fought.run.state.cards[idOf(fought.run.state, "17043")]?.zone).not.toBe("engaged");
  });
});

describe("17045:A:3 Pursuers from Mordor's shadow: +1 Attack, and 2 progress on the Orcs' stage if the attack destroys a character", () => {
  it("the attacker gets +1 Attack for the attack", () => {
    const fought = fightEnemy(table, "17045", URUK, { stage: "17048" }, options());
    const during = fought.during;
    expect(modifiedStat(during, during.cards[idOf(during, URUK)]!, "attack", fought.made.cards)).toBe(4 + 1);
  });

  it("a destroyed hero places 2 progress on the Orcs' stage, whatever stage the players are at; no destroyed character, no progress", () => {
    const hurt = (state: ScenarioState, made: LayoutTable): ScenarioState => { const set = prepare(state, made); return { ...set, cards: { ...set.cards, [made.hero]: { ...set.cards[made.hero]!, damage: 5 } } }; };
    const destroyed = fightEnemy(table, "17045", URUK, { stage: "17049" }, options({ tweak: hurt }));
    expect(destroyed.run.state.cards[destroyed.made.hero]?.zone).toBe("discard");
    expect(destroyed.run.state.cards[destroyed.run.state.orcs?.stage ?? ""]?.progress).toBe(2);
    const alive = fightEnemy(table, "17045", URUK, { stage: "17049" }, options());
    expect(alive.run.state.cards[alive.run.state.orcs?.stage ?? ""]?.progress).toBe(0);
  });
});

describe("17046:A:2 Howling at their Heels' shadow raises the defending player's threat by 1", () => {
  it("the defending player's threat is 1 higher after the shadow", () => {
    const fought = fightEnemy(table, "17046", URUK, { stage: "17048" }, options());
    expect((fought.run.state.seats[0]?.threat ?? 0) - (fought.start.seats[0]?.threat ?? 0)).toBe(1);
  });
});

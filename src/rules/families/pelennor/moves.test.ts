import { describe, expect, it } from "vitest";

import { canAttack } from "../../combat/combat.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { attackRuleReason } from "../attack/targets.ts";
import { spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { ally, enemy, hero, table } from "../defense/table.ts";

// Rules: rr.in-play-and-out-of-play, rr.engaged, rr.ranged, rr.step-6-8b (data/rules/entries.json); ledger lines 145053:A:2, 145080:A:1, 145050:A:1.
// The topmost Orc of the discard pile put into play engaged, the flag that lets only the engaged player attack, and the flag that allows one attacker at a time.

const focus = (seat: number) => ({ seat, sourceId: null });
const orc = (code: string) => enemy(code, { traits: ["Orc"] });
const flag = (state: ScenarioState, id: string, stat: "attackOnlyByEngaged" | "singleAttacker"): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat, amount: 1, until: "whileSourceInPlay" }] });

describe("PutTopmostFromEncounterDiscard (145053:A:2)", () => {
  function pile() {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("b"), orc("o1"), orc("o2"), enemy("troll"), ally("friend")], effects: [], heroes: [{ code: "a" }, { code: "b", seat: 1 }] });
    let state = built.state;
    const ids: Record<string, string> = {};
    for (const code of ["o1", "o2", "troll"]) {
      const spawned = spawn(state, code, { zone: "encounterDiscard" });
      state = spawned.state;
      ids[code] = spawned.id;
    }
    return { state, ids, ctx: built.ctx };
  }

  it("puts the last Orc discarded into play engaged with the actor, skipping a later card that is no Orc", () => {
    const { state, ids, ctx } = pile();
    const next = runInstruction(state, { verb: "PutTopmostFromEncounterDiscard", type: "enemy", trait: "Orc" }, focus(1), ctx, []);
    expect([next.cards[ids.o2!]?.zone, next.cards[ids.o2!]?.controller]).toEqual(["engaged", 1]);
    expect(next.cards[ids.o1!]?.zone).toBe("encounterDiscard");
    expect(next.cards[ids.troll!]?.zone).toBe("encounterDiscard");
  });

  it("does nothing when the pile holds no Orc", () => {
    const built = table({ cards: [hero("a"), enemy("troll")], effects: [], heroes: [{ code: "a" }] });
    const state = spawn(built.state, "troll", { zone: "encounterDiscard" }).state;
    expect(runInstruction(state, { verb: "PutTopmostFromEncounterDiscard", type: "enemy", trait: "Orc" }, focus(0), built.ctx, [])).toBe(state);
  });
});

describe("attackOnlyByEngaged (145080:A:1)", () => {
  function engaged() {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("b", { }), enemy("king")], effects: [], heroes: [{ code: "a" }, { code: "b", seat: 1 }], enemies: [{ code: "king", seat: 0 }] });
    return { ...built, state: flag(built.state, built.ids.king!, "attackOnlyByEngaged") };
  }

  it("lets the engaged player's characters attack and bars another seat's", () => {
    const { state, ids, ctx } = engaged();
    expect(canAttack(state, 0, ids.a!, ids.king!, ctx.cards)).toBe(true);
    expect(canAttack(state, 1, ids.b!, ids.king!, ctx.cards)).toBe(false);
  });

  it("bars a ranged character of another seat too", () => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("b", { keywords: { ranged: true } as never }), enemy("king")], effects: [], heroes: [{ code: "a" }, { code: "b", seat: 1 }], enemies: [{ code: "king", seat: 0 }] });
    const state = flag(built.state, built.ids.king!, "attackOnlyByEngaged");
    expect(canAttack(state, 1, built.ids.b!, built.ids.king!, built.ctx.cards)).toBe(false);
  });
});

describe("singleAttacker (145050:A:1)", () => {
  it("refuses a declaration of two attackers and allows one", () => {
    const built = table({ cards: [hero("a"), hero("c"), enemy("serpent")], effects: [], heroes: [{ code: "a" }, { code: "c" }], enemies: [{ code: "serpent" }] });
    const state = flag(built.state, built.ids.serpent!, "singleAttacker");
    expect(attackRuleReason(state, { type: "DeclareAttackers", enemyId: built.ids.serpent!, attackerIds: [built.ids.a!, built.ids.c!] })).toMatch(/more than 1 character/);
    expect(attackRuleReason(state, { type: "DeclareAttackers", enemyId: built.ids.serpent!, attackerIds: [built.ids.a!] })).toBeNull();
    expect(attackRuleReason(built.state, { type: "DeclareAttackers", enemyId: built.ids.serpent!, attackerIds: [built.ids.a!, built.ids.c!] })).toBeNull();
  });
});


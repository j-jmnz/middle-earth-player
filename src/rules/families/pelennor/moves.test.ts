import { describe, expect, it } from "vitest";

import { canAttack } from "../../combat/combat.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { attackRuleReason } from "../attack/targets.ts";
import { spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { travelBlocked } from "../../interpret/restrictions.ts";
import { ally, enemy, hero, send, table, until } from "../defense/table.ts";
import { definePrinted } from "../../core/printed.ts";

// Rules: rr.in-play-and-out-of-play, rr.engaged, rr.ranged, rr.step-6-8b (data/rules/entries.json); ledger lines 145053:A:2, 145080:A:1, 145050:A:1.
// The topmost Orc of the discard pile put into play engaged, the flag that lets only the engaged player attack, and the flag that allows one attacker at a time.

const focus = (seat: number) => ({ seat, sourceId: null });
const orc = (code: string) => enemy(code, { traits: ["Orc"] });
const flag = (state: ScenarioState, id: string, stat: "attackOnlyByEngaged" | "singleAttacker" | "undefendedToMinasTirith"): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat, amount: 1, until: "whileSourceInPlay" }] });

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


describe("undefendedToMinasTirith (145055:A:2)", () => {
  const city = definePrinted({ code: "145043", name: "Minas Tirith", type: "objective" });
  function attacked(withCity: boolean) {
    const built = table({ cards: [hero("a"), enemy("orc", { attack: 2, traits: ["Orc"] }), city], effects: [], heroes: [{ code: "a" }], enemies: [{ code: "orc" }], staging: withCity ? [{ code: "145043" }] : [] });
    const flagged = flag(built.state, built.ids.orc!, "undefendedToMinasTirith");
    const defense = until(send(flagged, { type: "DeclineEngage" }, built.ctx), built.ctx, (current) => current.window?.kind === "defense");
    const after = until(send(defense, { type: "Undefended", heroId: withCity ? built.ids["145043"]! : built.ids.a! }, built.ctx), built.ctx, (current) => current.pendingAttack == null && current.stack.length === 0);
    return { after, ids: built.ids };
  }

  it("places the undefended damage on Minas Tirith and none on the hero", () => {
    const { after, ids } = attacked(true);
    expect(after.cards[ids["145043"]!]?.damage).toBe(2);
    expect(after.cards[ids.a!]?.damage).toBe(0);
  });

  it("damages the hero as usual while Minas Tirith is out of play", () => {
    const { after, ids } = attacked(false);
    expect(after.cards[ids.a!]?.damage).toBe(2);
  });
});

describe("Restrict travel by trait (145075:B:3)", () => {
  it("bars travel to a location with the trait and no other", () => {
    const stage = definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 5 });
    const field = definePrinted({ code: "field", name: "Field", type: "location", threat: 1, questPoints: 2, traits: ["Pelennor"] });
    const gate = definePrinted({ code: "gate", name: "Gate", type: "location", threat: 1, questPoints: 2, traits: ["Minas Tirith"] });
    const built = table({ cards: [hero("a"), stage, field, gate], effects: [{ id: "stage:constant:1", cardCode: "stage", lines: ["stage:B:3"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel", trait: "Pelennor" }] }], heroes: [{ code: "a" }], staging: [{ code: "field" }, { code: "gate" }] });
    const questStage = spawn(built.state, "stage", { zone: "questStage" });
    expect(travelBlocked(questStage.state, built.ctx, built.ids.field!)).toBe(true);
    expect(travelBlocked(questStage.state, built.ctx, built.ids.gate!)).toBe(false);
  });
});

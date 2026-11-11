import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { resolveAmount, frameScope } from "../../interpret/amounts.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { withThreat } from "../../core/state.ts";
import { familyPlayBarred } from "../../interpret/family-hooks.ts";
import type { ScenarioState } from "../../core/state.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { spawn } from "../../core/zones.ts";
import { ally, enemy, hero, send, table, treachery, until, type TableSpec } from "../defense/table.ts";

// Rules: mec113.phantom, rr.step-6-4-3, rr.defending-player, rr.play-and-put-into-play, rr.threat-threat-dial (data/rules/entries.json); ledger lines 145022:A:1, 145023:A:3, 145065:B:1, 145063:B:2, 145064:B:3, 145064:B:1, 145021:A:1.
// The grey-company family: Phantom's cancel in the combat damage step, the flag that takes the keyword away, the hand discarded whole, the seat that cannot play cards and the two threat amounts.

const shade = treachery("shade");
const ghost = (code: string, attack = 3) => enemy(code, { attack, keywords: { phantom: true } });
const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";
const loses = (code: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "losesPhantom", amount: 1, until: "whileSourceInPlay", target: "self" }] });

function attacked(spec: Partial<TableSpec>, answer: (ids: Record<string, string>) => Parameters<typeof send>[1]) {
  const built = table({ cards: [hero("a"), ally("b"), ghost("shade-host"), shade], effects: [], heroes: [{ code: "a" }], enemies: [{ code: "shade-host" }], encounter: ["shade"], ...spec });
  const { ids, ctx } = built;
  const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, defenseWindow);
  const before = defense.seats[0].threat;
  const after = until(send(defense, answer(ids), ctx), ctx, (current) => current.pendingAttack == null);
  return { after, before, ids };
}

describe("Phantom (145022:A:1)", () => {
  it("cancels an undefended attack's damage and raises the defending player's threat by as much (mec113.phantom)", () => {
    const { after, before, ids } = attacked({}, (ids) => ({ type: "Undefended", heroId: ids.a! }));
    expect(after.cards[ids.a!]?.damage).toBe(0);
    expect(after.seats[0].threat).toBe(before + 3);
  });

  it("raises the threat by the damage a defender would have taken, not by the Attack: 3 Attack against 1 Defense is 2 (rr.step-6-4-3)", () => {
    const { after, before, ids } = attacked({ allies: [{ code: "b" }] }, (ids) => ({ type: "DeclareDefender", defenderId: ids.b! }));
    expect(after.cards[ids.b!]?.damage).toBe(0);
    expect(after.seats[0].threat).toBe(before + 2);
  });

  it("raises no threat when the defender takes no damage", () => {
    const { after, before, ids } = attacked({ cards: [hero("a"), ally("b", { defense: 4 }), ghost("shade-host"), shade], allies: [{ code: "b" }] }, (ids) => ({ type: "DeclareDefender", defenderId: ids.b! }));
    expect(after.cards[ids.b!]?.damage).toBe(0);
    expect(after.seats[0].threat).toBe(before);
  });

  it("deals ordinary damage once the enemy has lost the keyword (145023:A:3, 145065:B:1)", () => {
    const { after, before, ids } = attacked({ effects: [loses("shade-host")] }, (ids) => ({ type: "Undefended", heroId: ids.a! }));
    expect(after.cards[ids.a!]?.damage).toBe(3);
    expect(after.seats[0].threat).toBe(before);
  });

  it("leaves an enemy without the keyword alone", () => {
    const { after, before, ids } = attacked({ cards: [hero("a"), enemy("plain", { attack: 3 }), shade], enemies: [{ code: "plain" }] }, (ids) => ({ type: "Undefended", heroId: ids.a! }));
    expect(after.cards[ids.a!]?.damage).toBe(3);
    expect(after.seats[0].threat).toBe(before);
  });
});

describe("DiscardHand (145063:B:2)", () => {
  it("discards the whole hand of the actor, and only theirs", () => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("c"), ally("b"), ally("d")], effects: [], heroes: [{ code: "a" }, { code: "c", seat: 1 }], hand: [{ code: "b", key: "b1" }, { code: "b", key: "b2" }, { code: "d", seat: 1 }] });
    const { ctx, ids, state } = built;
    const next = runInstruction(state, { verb: "DiscardHand" }, { seat: 0, sourceId: null }, ctx, []);
    expect(next.seats[0].hand).toEqual([]);
    expect([ids.b1, ids.b2].map((id) => next.cards[id!]?.zone)).toEqual(["discard", "discard"]);
    expect(next.seats[1].hand).toHaveLength(1);
  });
});

describe("cannotPlayCards (145064:B:3)", () => {
  it("bars the seat that holds the flag from playing a card, not putting one into play, and not another seat", () => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("c"), ally("b")], effects: [], heroes: [{ code: "a" }, { code: "c", seat: 1 }], hand: [{ code: "b" }] });
    const { ctx, ids, state } = built;
    // The flag sits on the seat's pseudo card, as every seat flag does.
    expect(familyPlayBarred(state, ids.b!, ctx, undefined, { seat: 0 })).toBe(false);
    const seatFlag = { ...state, modifiers: [...state.modifiers, { instanceId: "seat:0", sourceId: ids.a!, stat: "cannotPlayCards" as const, amount: 1, until: "endOfPhase" as const }] };
    expect(familyPlayBarred(seatFlag, ids.b!, ctx, undefined, { seat: 0 })).toBe(true);
    expect(familyPlayBarred(seatFlag, ids.b!, ctx, undefined, { seat: 0, putting: true })).toBe(false);
    expect(familyPlayBarred(seatFlag, ids.b!, ctx, undefined, { seat: 1 })).toBe(false);
  });
});

describe("the threat amounts (145064:B:1, 145021:A:1)", () => {
  it("reads the highest threat among the living players, live", () => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("c")], effects: [], heroes: [{ code: "a" }, { code: "c", seat: 1 }] });
    const { ctx } = built;
    const scope = frameScope(built.state, 0, null);
    const at = (a: number, c: number) => withThreat(withThreat(built.state, 0, a), 1, c);
    expect(resolveAmount(at(31, 40), { highestThreat: true }, scope, ctx)).toBe(40);
    expect(resolveAmount(at(45, 40), { highestThreat: true }, scope, ctx)).toBe(45);
    expect(resolveAmount(at(31, 40), { highestThreat: true, times: 1 }, scope, ctx)).toBe(40);
  });

  it("counts the living players at or above a threat", () => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("c")], effects: [], heroes: [{ code: "a" }, { code: "c", seat: 1 }] });
    const scope = frameScope(built.state, 0, null);
    const at = (a: number, c: number) => withThreat(withThreat(built.state, 0, a), 1, c);
    expect(resolveAmount(at(34, 35), { playersAtThreat: 35 }, scope, built.ctx)).toBe(1);
    expect(resolveAmount(at(35, 50), { playersAtThreat: 35 }, scope, built.ctx)).toBe(2);
    expect(resolveAmount(at(20, 20), { playersAtThreat: 35 }, scope, built.ctx)).toBe(0);
  });
});

// Rules: rr.shadow-effects, rr.step-6-4-2 (data/rules/entries.json); ledger line 145021:A:3.
describe("an AfterAttack inside a Choose option (145021:A:3)", () => {
  const haunted: Effect = {
    id: "path:shadow:1",
    cardCode: "path",
    lines: ["path:A:3"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2 }] },
          { id: "staging", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
        ],
      },
    ],
  };

  function played(option: string) {
    const built = table({ cards: [hero("a"), enemy("brute", { attack: 1 }), treachery("path")], effects: [haunted], heroes: [{ code: "a" }], enemies: [{ code: "brute" }], encounter: ["path"] });
    const { ids, ctx } = built;
    const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, defenseWindow);
    const answered = send(defense, { type: "Undefended", heroId: ids.a! }, ctx);
    const asked = until(answered, ctx, (current, legal) => legal.some((intent) => intent.type === "Choose") || current.pendingAttack == null);
    const done = until(send(asked, { type: "Choose", optionId: option }, ctx), ctx, (current) => current.pendingAttack == null && current.stack.length === 0);
    return { done, ids, threat: defense.seats[0].threat };
  }

  it("returns the attacker to the staging area once the attack has ended", () => {
    const { done, ids } = played("staging");
    expect(done.cards[ids.brute!]?.zone).toBe("staging");
  });

  it("leaves it engaged when the other option is taken", () => {
    const { done, ids, threat } = played("threat");
    expect(done.cards[ids.brute!]?.zone).toBe("engaged");
    expect(done.seats[0].threat).toBe(threat + 2);
  });
});

// Rules: rr.lasting-effects (data/rules/entries.json); ledger line 145028:A:2.
describe("ModifyStat target ownCharacters (145028:A:2)", () => {
  it("holds for each character the actor controls, one that enters play later too, and for no other player's", () => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("c"), ally("b"), ally("d")], effects: [], heroes: [{ code: "a" }, { code: "c", seat: 1 }] });
    const { ctx, ids } = built;
    const lowered = runInstruction(built.state, { verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfRound", target: "ownCharacters" }, { seat: 0, sourceId: ids.a! }, ctx, []);
    const later = spawn(spawn(lowered, "b", { zone: "play", seat: 0 }).state, "d", { zone: "play", seat: 1 });
    const read = (id: string) => modifiedStat(later.state, later.state.cards[id]!, "willpower", ctx.cards);
    expect(read(ids.a!)).toBe(0);
    expect(read(ids.c!)).toBe(1);
    expect(read(Object.keys(later.state.cards).find((id) => later.state.cards[id]?.code === "b")!)).toBe(0);
    expect(read(later.id)).toBe(1);
  });
});

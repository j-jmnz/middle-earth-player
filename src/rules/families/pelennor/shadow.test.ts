import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { definePrinted } from "../../core/printed.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { ally, enemy, hero, send, table, treachery, until } from "../defense/table.ts";

// Rules: rr.shadow-effects, rr.step-6-4-3, rr.attachment-cards, rr.engaged (data/rules/entries.json); ledger lines 145058:A:2, 145055:A:3.
// A shadow card that attaches to the hero its attack damaged, and a shadow enemy that engages the defending player.

const dart = definePrinted({ code: "dart", name: "Black Dart", type: "treachery" });
const attaches: Effect = { id: "dart:shadow:1", cardCode: "dart", lines: ["dart:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "AttachShadowToHero", code: "dart", when: { kind: "dealt" } }] }] };
const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";

function attacked(answer: (ids: Record<string, string>) => Parameters<typeof send>[1], opts: { armor?: number } = {}) {
  const built = table({ cards: [hero("a"), ally("b", { defense: opts.armor ?? 1 }), enemy("host"), dart, treachery("other")], effects: [attaches], heroes: [{ code: "a" }], allies: [{ code: "b" }], enemies: [{ code: "host" }], encounter: ["dart"] });
  const defense = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, defenseWindow);
  const after = until(send(defense, answer(built.ids), built.ctx), built.ctx, (current) => current.pendingAttack == null && current.stack.length === 0);
  return { after, ids: built.ids };
}

describe("AttachShadowToHero (145058:A:2)", () => {
  it("attaches the shadow card faceup to the hero an undefended attack damaged", () => {
    const { after, ids } = attacked((ids) => ({ type: "Undefended", heroId: ids.a! }));
    const card = after.cards[ids["deck:dart"]!]!;
    expect([card.zone, card.host, card.face]).toEqual(["attached", ids.a, "up"]);
    expect(after.cards[ids.a!]?.attachments).toContain(card.id);
  });

  it("attaches nothing when the defending character is an ally", () => {
    const { after, ids } = attacked((ids) => ({ type: "DeclareDefender", defenderId: ids.b! }));
    expect(after.cards[ids["deck:dart"]!]?.zone).not.toBe("attached");
    expect(after.cards[ids.b!]?.attachments).toEqual([]);
  });

  it("attaches nothing when the hero takes no damage", () => {
    const built = table({ cards: [hero("a", { defense: 9 }), enemy("host", { attack: 0 }), dart], effects: [attaches], heroes: [{ code: "a" }], enemies: [{ code: "host" }], encounter: ["dart"] });
    const defense = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, defenseWindow);
    const after = until(send(defense, { type: "Undefended", heroId: built.ids.a! }, built.ctx), built.ctx, (current) => current.pendingAttack == null && current.stack.length === 0);
    expect(after.cards[built.ids["deck:dart"]!]?.zone).not.toBe("attached");
  });
});

describe("EngageShadowCard (145055:A:3)", () => {
  it("moves the shadow enemy off its attacker and engages the defending player", () => {
    const orc = enemy("orc", { traits: ["Orc"] });
    const built = table({ seatCount: 2, cards: [hero("a"), hero("b"), enemy("host"), orc], effects: [], heroes: [{ code: "a" }, { code: "b", seat: 1 }], enemies: [{ code: "host", seat: 1 }] });
    const shadow = spawn(built.state, "orc", { zone: "shadow", enemyId: built.ids.host! });
    const state: ScenarioState = { ...shadow.state, pendingAttack: { enemyId: built.ids.host!, seat: 1 } };
    const next = runInstruction(state, { verb: "EngageShadowCard" }, { seat: 1, sourceId: shadow.id }, built.ctx, []);
    const card = next.cards[shadow.id]!;
    expect([card.zone, card.controller, card.host]).toEqual(["engaged", 1, null]);
    expect(next.cards[built.ids.host!]?.shadowId).toBeNull();
    expect(next.seats[1].engaged).toContain(shadow.id);
  });

  it("does nothing for a shadow card that is no enemy", () => {
    const built = table({ cards: [hero("a"), enemy("host"), dart], effects: [], heroes: [{ code: "a" }], enemies: [{ code: "host" }] });
    const shadow = spawn(built.state, "dart", { zone: "shadow", enemyId: built.ids.host! });
    const state: ScenarioState = { ...shadow.state, pendingAttack: { enemyId: built.ids.host!, seat: 0 } };
    expect(runInstruction(state, { verb: "EngageShadowCard" }, { seat: 0, sourceId: shadow.id }, built.ctx, [])).toBe(state);
  });
});

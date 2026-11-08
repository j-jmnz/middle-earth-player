import { describe, expect, it } from "vitest";

import { expectOk } from "../../core/test-fixture.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import { holds } from "../../interpret/conditions.ts";
import { actionWindow, record, table } from "./fixture.ts";

// Rules: rr.step-6-8b, rr.step-6-8-1, rr.step-6-8-2, rr.step-6-8-3, rr.step-6-8-4, rr.response, rr.lasting-effects, rr.ranged,
// rr.attacks-outside-the-combat-phase, faq.limitations-on-attacks (data/rules/entries.json); ledger line 143015:A:3.
// The player attack: Responses to the declaration before its strength, "for this attack" ending with it, conditions on the
// enemy attacked, attacks an effect declares, attacks into the staging area and a card's attack window.

describe("a declared player attack", () => {
  it("resolves the Responses to the declaration before its damage, and ends its for-this-attack modifiers (rr.response, rr.step-6-8-4)", () => {
    const boost = record("aragorn:response:1", "aragorn", "response", [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack" }], { trigger: "declaredAttacker", subject: "self" });
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }], [boost]);
    const declared = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!] }, ctx)).state;
    expect(declared.cards[ids.orc!]?.damage).toBe(0);
    expect(legalIntents(declared, ctx)).toContainEqual({ type: "Trigger", cardId: ids.aragorn, effectId: "aragorn:response:1" });
    const used = expectOk(reduce(declared, { type: "Trigger", cardId: ids.aragorn!, effectId: "aragorn:response:1" }, ctx)).state;
    // 2 + 3 Attack against 1 Defense.
    expect(used.cards[ids.orc!]?.damage).toBe(4);
    expect(used.modifiers.filter((modifier) => modifier.until === "endOfAttack")).toEqual([]);
    expect(used.window?.kind).toBe("playerAttack");
  });

  it("reads a modifier's condition on the enemy attacked: +1 Attack when attacking an Orc", () => {
    const blade = record("aragorn:constant:1", "aragorn", "constant", [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", when: { kind: "attacking", enemy: { type: "enemy", control: "any", trait: "Orc" } } }]);
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }, { code: "troll", at: { zone: "engaged", seat: 0 } }], [blade]);
    const orc = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!] }, ctx)).state;
    expect(orc.cards[ids.orc!]?.damage).toBe(2);
    // Not attacking, the bonus is not there.
    expect(modifiedStat(orc, orc.cards[ids.aragorn!]!, "attack", ctx.cards)).toBe(2);
    const ready = { ...state, cards: { ...state.cards } };
    const troll = expectOk(reduce(ready, { type: "DeclareAttackers", enemyId: ids.troll!, attackerIds: [ids.aragorn!] }, ctx)).state;
    expect(troll.cards[ids.troll!]?.damage).toBe(2);
  });

  it("keeps a lasting effect's stat condition on the modifier: +3 Attack while attacking an enemy above your threat (04004:A:1)", () => {
    const strike = record("event:action:1", "event", "action", [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfPhase", target: "picked", when: { kind: "versusHighEngagement", role: "attacking" } }]);
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }, { code: "event", at: { zone: "hand", seat: 0 } }], [strike]);
    const played = expectOk(reduce(actionWindow(state), { type: "PlayCard", cardId: ids.event!, payments: [] }, ctx)).state;
    expect(played.modifiers.some((modifier) => modifier.stat === "attack" && modifier.when?.kind === "versusHighEngagement")).toBe(true);
    const attacked = expectOk(reduce({ ...played, mode: "playerAttacks", window: { kind: "playerAttack" } }, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!] }, ctx)).state;
    // Engagement cost 30 is above threat 20: 2 + 3 against 1.
    expect(attacked.cards[ids.orc!]?.damage).toBe(4);
  });

  it("lets an attacker ignore the enemy's Defense while attacking alone (02123:A:1)", () => {
    const runner = record("gimli:constant:1", "gimli", "constant", [{ verb: "ModifyStat", stat: "ignoresDefense", amount: 1, until: "whileSourceInPlay" }], { condition: { kind: "attacking", alone: true } });
    const { state, ids, ctx } = table([{ code: "gimli", at: { zone: "heroes", seat: 0 } }, { code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }], [runner]);
    const alone = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.gimli!] }, ctx)).state;
    expect(alone.cards[ids.orc!]?.damage).toBe(3);
    const together = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.gimli!, ids.aragorn!] }, ctx)).state;
    expect(together.cards[ids.orc!]?.damage).toBe(4);
  });
});

describe("the events of a player attack", () => {
  it("tells each attacker it attacked, damaged and destroyed the enemy, and with whom the enemy was engaged", () => {
    const heard = (trigger: "attacked" | "attackDamaged" | "attackDestroyedEngaged", n: number) =>
      record(`archer:forced:${n}`, "archer", "forced", [{ verb: "ModifyStat", stat: "willpower", amount: 1, until: "endOfRound" }], { trigger, subject: "self" });
    const lower = record("archer:response:1", "archer", "response", [{ verb: "LowerThreat", amount: { stat: "threat", of: "other", printed: true, plus: 2 }, who: "eventSeat" }], { trigger: "attackDestroyedEngaged", subject: "self" });
    const { state, ids, ctx } = table(
      [{ code: "archer", at: { zone: "heroes", seat: 0 } }, { code: "aragorn", at: { zone: "heroes", seat: 1 } }, { code: "goblin", at: { zone: "engaged", seat: 1 } }],
      [heard("attacked", 1), heard("attackDamaged", 2), lower],
      [],
      2,
    );
    // The ranged archer attacks the enemy engaged with seat 1.
    const attacked = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.goblin!, attackerIds: [ids.archer!] }, ctx)).state;
    expect(attacked.cards[ids.goblin!]?.zone).toBe("encounterDiscard");
    const used = expectOk(reduce(attacked, { type: "Trigger", cardId: ids.archer!, effectId: "archer:response:1" }, ctx)).state;
    expect(modifiedStat(used, used.cards[ids.archer!]!, "willpower", ctx.cards)).toBe(3);
    expect(used.seats[1]?.threat).toBe(17);
    expect(used.seats[0]?.threat).toBe(20);
  });

  it("runs effects delayed to the end of the attack, with the enemy as their other card (Delay endOfAttack)", () => {
    const spear = record("gear:response:1", "gear", "response", [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "host" }, { verb: "Delay", until: "endOfAttack", instructions: [{ verb: "Discard", target: { kind: "self" } }] }], { trigger: "declaredAttacker", subject: "host" });
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }, { code: "gear", at: { zone: "play", seat: 0 } }], [spear]);
    const host = { ...state, cards: { ...state.cards, [ids.gear!]: { ...state.cards[ids.gear!]!, host: ids.aragorn!, zone: "attached" as const } } };
    const withGear = { ...host, cards: { ...host.cards, [ids.aragorn!]: { ...host.cards[ids.aragorn!]!, attachments: [ids.gear!] } } };
    const declared = expectOk(reduce(withGear, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!] }, ctx)).state;
    const used = expectOk(reduce(declared, { type: "Trigger", cardId: ids.gear!, effectId: "gear:response:1" }, ctx)).state;
    expect(used.cards[ids.orc!]?.damage).toBe(4);
    expect(used.cards[ids.gear!]?.zone).toBe("discard");
    expect(used.delayed).toEqual([]);
    expect(used.window?.kind).toBe("playerAttack");
  });

  it("turns Attack kept for the next attack into Attack for this attack (19090:A:1)", () => {
    const { state, ids, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }]);
    const kept = { ...state, modifiers: [{ instanceId: ids.aragorn!, sourceId: ids.aragorn!, stat: "nextAttackBonus" as const, amount: 2, until: "endOfPhase" as const }] };
    const attacked = expectOk(reduce(kept, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!] }, ctx)).state;
    expect(attacked.cards[ids.orc!]?.damage).toBe(3);
    expect(attacked.modifiers).toEqual([]);
  });
});

describe("the sole attacker (143015:A:3)", () => {
  it("holds when exactly one character was declared as an attacker in the attack under way", () => {
    const { state, ctx } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }], []);
    const scope = { actor: 0, sourceId: null, returned: 0 } as const;
    const one = { ...state, pendingStrike: { seat: 0, enemyId: "e", attackerIds: ["a"] } };
    const two = { ...state, pendingStrike: { seat: 0, enemyId: "e", attackerIds: ["a", "b"] } };
    expect(holds(one, { kind: "soleAttacker" }, scope, ctx)).toBe(true);
    expect(holds(two, { kind: "soleAttacker" }, scope, ctx)).toBe(false);
    expect(holds(state, { kind: "soleAttacker" }, scope, ctx)).toBe(false);
  });
});

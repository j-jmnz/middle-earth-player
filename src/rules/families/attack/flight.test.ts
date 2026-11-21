// Rules: rr.ranged, rr.cannot, rr.traits (data/rules/entries.json); ledger lines 02070:A:1, 02071:A:1, 900606:A:2.
// The enemy flags `eagleOrRangedOnly` and `cannotBeAttackedByRanged`: who may be declared as an attacker or a defender against the enemy.
import { describe, expect, it } from "vitest";

import { canAttack } from "../../combat/combat.ts";
import { defenseBlocked } from "../../interpret/restrictions.ts";
import type { ScenarioState } from "../../core/state.ts";

import { fighter, foe, table } from "./fixture.ts";

const EAGLE = fighter("eagle", { traits: ["Eagle"] });
const FLOCK = foe("flock", { traits: ["Creature"] });
const made = (...stats: readonly ("eagleOrRangedOnly" | "cannotBeAttackedByRanged" | "losesEagle" | "loseRanged")[]) => {
  const t = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "eagle", at: { zone: "heroes", seat: 0 } }, { code: "archer", at: { zone: "heroes", seat: 0 } }, { code: "flock", at: { zone: "engaged", seat: 0 } }], [], [EAGLE, FLOCK]);
  const holder = (stat: string) => (stat === "losesEagle" ? t.ids.eagle : stat === "loseRanged" ? t.ids.archer : t.ids.flock) ?? "";
  const modifiers = stats.map((stat) => ({ instanceId: holder(stat), sourceId: t.ids.flock ?? "", stat, amount: 1, until: "endOfGame" as const }));
  return { ...t, state: { ...t.state, modifiers } as ScenarioState };
};
const attacks = (t: ReturnType<typeof made>, who: string) => canAttack(t.state, 0, t.ids[who] ?? "", t.ids.flock ?? "", t.ctx.cards);
const defends = (t: ReturnType<typeof made>, who: string) => !defenseBlocked({ ...t.state, pendingAttack: { enemyId: t.ids.flock ?? "", seat: 0 } }, t.ctx, t.ids[who] ?? "");

describe("02070:A:1 eagleOrRangedOnly", () => {
  it("02070:A:1 lets an Eagle character and a character with ranged attack and defend, and no other", () => {
    const t = made("eagleOrRangedOnly");
    expect([attacks(t, "eagle"), attacks(t, "archer"), attacks(t, "aragorn")]).toEqual([true, true, false]);
    expect([defends(t, "eagle"), defends(t, "archer"), defends(t, "aragorn")]).toEqual([true, true, false]);
  });

  it("02070:A:1 holds back nobody without the flag", () => {
    const t = made();
    expect([attacks(t, "aragorn"), defends(t, "aragorn")]).toEqual([true, true]);
  });

  it("02070:A:1 does not count the Eagle trait a card lost, nor a keyword it lost to Pitch-dark Thicket", () => {
    const t = made("eagleOrRangedOnly", "losesEagle", "loseRanged");
    expect([attacks(t, "eagle"), attacks(t, "archer")]).toEqual([false, false]);
    expect([defends(t, "eagle"), defends(t, "archer")]).toEqual([false, false]);
  });
});

describe("02070:A:1 with a gained Eagle trait (rr.traits)", () => {
  it("02070:A:1 counts the Eagle trait a character gained from a modifier, like Come Together's chosen Trait", () => {
    const t = made("eagleOrRangedOnly");
    const gained = { instanceId: t.ids.aragorn ?? "", sourceId: t.ids.aragorn ?? "", stat: "traitGained" as const, amount: 1, until: "endOfRound" as const, trait: "Eagle" };
    const next = { ...t, state: { ...t.state, modifiers: [...t.state.modifiers, gained] } };
    expect([attacks(next, "aragorn"), defends(next, "aragorn")]).toEqual([true, true]);
  });
});

describe("900606:A:2 cannotBeAttackedByRanged", () => {
  it("900606:A:2 bars the character with ranged from attacking the enemy, and only that one", () => {
    const t = made("cannotBeAttackedByRanged");
    expect([attacks(t, "archer"), attacks(t, "aragorn"), attacks(t, "eagle")]).toEqual([false, true, true]);
  });

  it("900606:A:2 lets a character that lost ranged attack", () => {
    const t = made("cannotBeAttackedByRanged", "loseRanged");
    expect(attacks(t, "archer")).toBe(true);
  });
});

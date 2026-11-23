// Rules: rr.shadow-effects, mec109.hide-tests, mec109.the-one-ring, ltp.undefended-attack, faq.next-player (data/rules/entries.json); ledger lines 141072:A:2, 906105:A:3, 141036:A:2, 141038:A:2, 906106:A:3, 906108:A:2, 141076:A:3, 906109:A:3, 906102:A:2.
// A Shadow of the Past's Shadow effects whose condition reads a failed Hide test or The One Ring, each with the condition's false case, and Khamûl's engagement cost. A failed test is put on the table as the
// Hide frame records it (`hideFailures`: the seat, the round, the phase), so the attack is the only thing the test plays. f0 attacks for 1; the stand-in heroes dh1 to dh3 have 2 Defense and 6 hit points.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { fightEnemy, finish, idOf, revealFromTop, send, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";

const SCENARIO = "a-shadow-of-the-past";
const RING = "141085";
const table = (layout: Layout): LayoutTable => tableFromLayout(SCENARIO, layout, { extra: [RING] });
const damage = (state: ScenarioState, code: string) => state.cards[idOf(state, code)]?.damage ?? 0;

// The seat failed a Hide test in this round's quest phase, or in an earlier round's.
const failed = (seat: number, earlier = false) => (state: ScenarioState): ScenarioState => ({ ...state, round: 2, hideFailures: [{ seat, round: earlier ? 1 : 2, phase: "Quest" }] });

// f0 attacks the first seat with the Shadow card, nobody defending, the table changed by `tweak` first: the damage the first hero takes.
function undefendedDamage(shadow: string, tweak?: (state: ScenarioState) => ScenarioState, layout: Layout = {}): number {
  const fought = fightEnemy(table, shadow, "f0", layout, { undefended: true, ...(tweak ? { tweak } : {}) });
  return damage(fought.run.state, "dh1");
}

describe("Shadows that read a Hide test failed this round", () => {
  // 141036 Green Hill Country: "Attacking enemy gets +1 Attack (+2 Attack instead if you have failed a Hide test this round)." 141038 The Marish: "(+2 Attack instead if the defending player failed a Hide test this round)".
  it.each([
    ["141036:A:2", "141036"],
    ["141038:A:2", "141038"],
  ])("%s the attacking enemy gets +2 Attack when the defending player failed a Hide test this round", (_line, shadow) => {
    expect(undefendedDamage(shadow, failed(0))).toBe(3);
  });

  it.each([
    ["141036:A:2", "141036"],
    ["141038:A:2", "141038"],
  ])("%s a Hide test failed in an earlier round, or by another player, gives only +1 Attack", (_line, shadow) => {
    expect(undefendedDamage(shadow, failed(0, true))).toBe(2);
    expect(undefendedDamage(shadow, failed(1), { seats: 2 })).toBe(2);
  });

  // 906106 Stock Woods: "Attacking enemy gets +2 Attack (+3 Attack instead if you have failed a Hide test this round)."
  it("906106:A:3 the attacking enemy gets +3 Attack when the defending player failed a Hide test this round, and +2 when another player did", () => {
    expect(undefendedDamage("906106", failed(0))).toBe(4);
    expect(undefendedDamage("906106", failed(1), { seats: 2 })).toBe(3);
  });

  // 906108 Followed by Shadows: "Shadow: If the defending player has failed a Hide test this round, this attack is considered undefended."
  it("906108:A:2 the attack dh1 defends is undefended when the defending player failed a Hide test this round, and its damage goes on a hero", () => {
    const fought = fightEnemy(table, "906108", "f0", {}, { tweak: failed(0) });
    // dh1's 2 Defense would block f0's 1 Attack; undefended, the 1 damage goes on a hero the player names.
    expect(damage(fought.run.state, "dh1") + damage(fought.run.state, "dh2")).toBe(1);
  });

  it("906108:A:2 a Hide test failed by another player leaves the attack defended", () => {
    const fought = fightEnemy(table, "906108", "f0", { seats: 2 }, { tweak: failed(1) });
    expect(damage(fought.run.state, "dh1") + damage(fought.run.state, "dh2")).toBe(0);
  });
});

describe("Shadows and constants that read The One Ring", () => {
  const ring = { attached: [{ code: RING, to: "dh1" }] } as const;
  const exhaustRing = (state: ScenarioState): ScenarioState => updateCard(state, idOf(state, RING), { exhausted: true });

  // 141076 Lure of the Ring: "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if The One Ring is exhausted)."
  it("141076:A:3 the attacking enemy gets +1 Attack while The One Ring is ready and +2 while it is exhausted", () => {
    expect(undefendedDamage("141076", undefined, ring)).toBe(2);
    expect(undefendedDamage("141076", exhaustRing, ring)).toBe(3);
  });

  // 906102 Khamûl the Easterling: "Khamûl the Easterling gets -30 engagement cost while The One Ring is exhausted." (printed 40). Lure of the Ring's first option exhausts it ("exhaust The One Ring", 141076:A:2).
  it("906102:A:2 its engagement cost is 10 once Lure of the Ring has exhausted The One Ring, and 40 while the Ring is ready", () => {
    const made = table({ staging: ["906102"], deck: ["f0", "f0"], ...ring });
    const khamul = () => idOf(made.state, "906102");
    expect(modifiedStat(made.state, made.state.cards[khamul()]!, "engagementCost", made.ctx.cards)).toBe(40);
    const steps: EngineStep[] = [];
    let run = { state: revealFromTop(start(made.state).state, made.ctx, "141076", steps).state, steps };
    expect(run.state.window?.kind).toBe("choose");
    run = finish(send(run, { type: "Choose", optionId: "exhaust" }, made.ctx), made.ctx);
    const after = syncConstants(run.state, made.ctx);
    expect(after.cards[idOf(after, RING)]?.exhausted).toBe(true);
    expect(modifiedStat(after, after.cards[khamul()]!, "engagementCost", made.ctx.cards)).toBe(10);
  });
});

describe("Shadows that engage the next player", () => {
  // 141072 Pathless Country and 906105 Green-Hill Country: "After this attack, the attacking enemy engages the next player then makes an immediate attack." With one player there is no next player, and
  // the attack after "then" does not happen either (faq.next-player).
  it.each([
    ["141072:A:2", "141072"],
    ["906105:A:3", "906105"],
  ])("%s with one player the attacking enemy stays engaged and does not attack again", (_line, shadow) => {
    // The stand-in f3 (1 Attack) attacks, so the f0 cards of the encounter deck are not mistaken for it.
    const fought = fightEnemy(table, shadow, "f3", {}, { undefended: true });
    expect(fought.run.state.cards[idOf(fought.run.state, "f3")]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(damage(fought.run.state, "dh1")).toBe(1);
  });
});

describe("906109 Sniffing and Hissing", () => {
  // "Shadow: Attacking enemy gets +2 Attack. If this attack destroys a character, raise your threat by 3."
  it("906109:A:3 an attack that destroys no character raises no threat", () => {
    const fought = fightEnemy(table, "906109", "f0", {});
    // f0 attacks for 3 against dh1's 2 Defense: 1 damage, dh1 survives.
    expect(damage(fought.run.state, "dh1")).toBe(1);
    expect(fought.run.state.seats[0]?.threat).toBe(28);
  });
});

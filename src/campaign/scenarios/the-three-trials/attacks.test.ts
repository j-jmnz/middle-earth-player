// Rules: rm.time-x, rr.attacks-outside-the-combat-phase, faq.enemy-attacks-outside-combat, rr.engaged, rr.shadow-effects, rr.travel, rr.forced (data/rules/entries.json).
// The attacks the Guardians make in The Three Trials: Stone Barrow's threat for each attack (also an immediate or a canceled one), the Wolf's Guardian's counters after its immediate attack, The Guardian's Fury on a Guardian in the staging area and Hallowed Circle's attacks.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; the filler enemy has 1 Attack.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { fight, fightEnemy, finish, idOf, resolveRecords, run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-three-trials";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The immediate attack of the Wolf's Guardian (its own Forced effect) on the first seat, played to its end with nobody defending; `cancel` cancels it once it is declared.
function attacked(t: ReturnType<typeof table>, code: "08041", cancel = false): ScenarioState {
  let state = resolveRecords(t.state, t.ctx, code, "forced", idOf(t.state, code)).state;
  if (cancel) state = run(t, state, { verb: "CancelAttack" });
  return finish(fight(t, { state, steps: [] }, (current) => current.pendingAttack == null, { heroCode: "dh1" }), t.ctx).state;
}

describe("08048:A:1 Stone Barrow", () => {
  const stone = (layout: Layout = {}) => table({ staging: ["08048"], engaged: ["08041"], threat: [20, 20], ...layout });

  it("08048:A:1 raises each player's threat by the attacking Guardian's Threat after an attack: 2", () => {
    const t = stone({ seats: 2 });
    expect(attacked(t, "08041").seats.map((seat) => seat.threat)).toEqual([22, 22]);
  });

  it("08048:A:1 counts the Threat as it stands now, with a modifier the Guardian holds", () => {
    const t = stone({ modified: [{ code: "08041", from: "08048", stats: [["threat", 3]] }] });
    expect(attacked(t, "08041").seats[0]?.threat).toBe(25);
  });

  it("08048:A:1 counts an attack that was canceled as well", () => {
    expect(attacked(stone(), "08041", true).seats[0]?.threat).toBe(22);
  });

  it("08048:A:1 counts an immediate attack once", () => {
    expect(attacked(stone(), "08041").seats[0]?.threat).toBe(22);
  });
});

describe("08041:A:2 the Wolf's Guardian", () => {
  it("08041:A:2 puts its 3 counters on again after its immediate attack, once the attack is over (the Forced effect waits for the attack to end)", () => {
    const t = table({ engaged: [{ code: "08041", seat: 0, resources: 0 }] });
    const forced = resolveRecords(t.state, t.ctx, "08041", "forced", idOf(t.state, "08041"));
    expect(forced.state.pendingAttack?.enemyId).toBe(idOf(forced.state, "08041"));
    expect(cardsOf(forced.state, "08041")[0]?.resources).toBe(0);
    const over = fight(t, forced, (current) => current.pendingAttack == null, { heroCode: "dh1" }).state;
    expect([over.pendingAttack, cardsOf(over, "08041")[0]?.resources]).toEqual([null, 3]);
  });
});

describe("08054:A:1 The Guardian's Fury", () => {
  it("08054:A:1 makes a Guardian in the staging area attack the first player from there, and a Guardian engaged with the second player attack that player", () => {
    const staged = table({ seats: 2, staging: ["08040"] });
    const first = resolveRecords(staged.state, staged.ctx, "08054", "whenRevealed");
    expect([first.state.pendingAttack?.enemyId, first.state.pendingAttack?.seat]).toEqual([idOf(first.state, "08040"), 0]);
    const engaged = table({ seats: 2, engaged: [{ code: "08040", seat: 1 }] });
    const second = resolveRecords(engaged.state, engaged.ctx, "08054", "whenRevealed");
    expect([second.state.pendingAttack?.enemyId, second.state.pendingAttack?.seat]).toEqual([idOf(second.state, "08040"), 1]);
  });

  it("08054:A:1 reveals no Guardian from the victory display while one is in the staging area", () => {
    const t = table({ staging: ["08040"], victory: ["08042"] });
    const { state } = resolveRecords(t.state, t.ctx, "08054", "whenRevealed");
    expect(state.victory).toHaveLength(1);
  });
});

describe("08049:A:3 Hallowed Circle's Forced effect", () => {
  it("08049:A:3 makes each engaged Guardian attack its player once after the players travel there, and a Guardian in the staging area does not attack", () => {
    const t = table({ seats: 2, staging: ["08049", "08041"], engaged: [{ code: "08040", seat: 1 }] });
    const { state } = resolveRecords(t.state, t.ctx, "08049", "forced", idOf(t.state, "08049"));
    expect([state.pendingAttack?.enemyId, state.pendingAttack?.seat]).toEqual([idOf(state, "08040"), 1]);
  });
});

describe("08054:A:2 the Guardian's Fury as a Shadow card", () => {
  it("08054:A:2 gives a Guardian attacker one more attack after the first, and an attacker that is not a Guardian none", () => {
    const attacks = (enemy: string) => fightEnemy(table, "08054", enemy, { heroResources: 0 }, { undefended: true }).run.steps.filter((step) => step.kind === "attack" && step.side === "enemy").length;
    expect(attacks("08040")).toBe(2);
    expect(attacks("f0")).toBe(1);
  });
});

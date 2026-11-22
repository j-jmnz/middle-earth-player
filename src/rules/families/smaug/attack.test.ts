// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town), rr.attacks-outside-the-combat-phase, rr.defending-player, rr.damage, faq.enemy-attacks-outside-combat; ledger lines 50211:A:1, 50206:A:2, 50214:A:1.
// Smaug's attack against Lake-town: the last player may declare a defender; undefended, all the damage goes on Lake-town; defended, the damage beyond the defender's hit points does. Smaug the Magnificent's excess goes on Lake-town in any attack. Allies cannot defend against a Smaug that bars them.
import { describe, expect, it } from "vitest";

import { legalTargets } from "../../engine/legal.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { send } from "../defense/table.ts";
import { updateCard } from "../../core/state.ts";
import { LAKE, MAGNIFICENT, MIGHTY, damageOn, lakeTable, run } from "./fixture.ts";
import { lastSeat } from "./cards.ts";
import type { Effect } from "../../../catalog/boundary.ts";

const options = (made: ReturnType<typeof lakeTable>, state: Parameters<typeof legalIntents>[0]) => legalIntents(state, made.ctx);

describe("AttackLakeTown (50211:A:1)", () => {
  it("makes the Smaug in the staging area attack the last player, outside the combat phase", () => {
    const made = lakeTable({ seatCount: 2, staging: [{ code: MIGHTY }], encounter: ["x"] });
    const state = run(made, made.state, { verb: "AttackLakeTown" });
    expect(state.pendingAttack).toMatchObject({ enemyId: made.ids[MIGHTY], seat: 1, toLakeTown: true, excessToLakeTown: true, immediate: true });
  });

  it("does nothing with no Smaug in play", () => {
    const made = lakeTable({ seatCount: 2, staging: [] });
    expect(run(made, made.state, { verb: "AttackLakeTown" }).pendingAttack).toBeNull();
  });

  it("puts all the damage of an undefended attack on Lake-town and none on a hero", () => {
    const made = lakeTable({ staging: [{ code: MIGHTY }], encounter: ["x"] });
    const attacked = run(made, made.state, { verb: "AttackLakeTown" });
    expect(options(made, attacked).some((intent) => intent.type === "Undefended")).toBe(true);
    const undefended = send(attacked, { type: "Undefended" }, made.ctx);
    expect(damageOn(undefended, LAKE)).toBe(5);
    expect(damageOn(undefended, "h1")).toBe(0);
  });

  it("puts the damage beyond a defender's remaining hit points on Lake-town, and the rest on the defender", () => {
    const made = lakeTable({ staging: [{ code: MIGHTY }], encounter: ["x"] });
    const hurt = updateCard(made.state, made.ids.h1 ?? "", { damage: 3 });
    const attacked = run(made, hurt, { verb: "AttackLakeTown" });
    const defended = send(attacked, { type: "DeclareDefender", defenderId: made.ids.h1 ?? "" }, made.ctx);
    // Attack 5 less Defense 1 is 4 damage; 2 hit points were left: the hero is destroyed and 2 go on Lake-town.
    expect(damageOn(defended, LAKE)).toBe(2);
    expect(defended.cards[made.ids.h1 ?? ""]?.zone).toBe("discard");
  });

  it("is the last player's, in turn order from the first player", () => {
    const made = lakeTable({ seatCount: 2 });
    expect(lastSeat(made.state)).toBe(1);
    expect(lastSeat({ ...made.state, firstPlayer: 1 })).toBe(0);
  });
});

describe("the excess damage of Smaug the Magnificent (50206:A:2)", () => {
  const flag: Effect = { id: `${MAGNIFICENT}:constant:1`, cardCode: MAGNIFICENT, lines: [`${MAGNIFICENT}:A:2`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "excessToLakeTown", amount: 1, until: "whileSourceInPlay", target: "self" }] };

  it("goes on Lake-town when he attacks a player in the combat phase and the defender cannot take it all", () => {
    const made = lakeTable({ staging: [], enemies: [{ code: MAGNIFICENT }], effects: [flag] });
    const hurt = updateCard(made.state, made.ids.h1 ?? "", { damage: 4 });
    const asked = run(made, hurt, { verb: "ImmediateAttackBy" }, made.ids[MAGNIFICENT]);
    expect(asked.pendingAttack).toMatchObject({ enemyId: made.ids[MAGNIFICENT] });
    const defended = send(asked, { type: "DeclareDefender", defenderId: made.ids.h1 ?? "" }, made.ctx);
    // Attack 8 less Defense 1 is 7; one hit point was left, so 6 go on Lake-town.
    expect(damageOn(defended, LAKE)).toBe(6);
  });
});

describe("Allies cannot be declared as defenders against a Smaug that bars them (50214:A:1)", () => {
  it("refuses an ally and accepts a hero", () => {
    const made = lakeTable({ staging: [{ code: MIGHTY }], allies: [{ code: "a1" }], encounter: ["x"] });
    const barred = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: made.ids[MIGHTY] ?? "", sourceId: made.ids[MIGHTY] ?? "", stat: "alliesCannotDefend" as const, amount: 1, until: "endOfRound" as const }] };
    const attacked = run(made, barred, { verb: "AttackLakeTown" });
    const defenders = legalTargets(attacked, { type: "DeclareDefender" }, made.ctx);
    expect(defenders).not.toContain(made.ids.a1);
    expect(defenders).toContain(made.ids.h1);
    // Without the flag the ally may defend.
    expect(legalTargets(run(made, made.state, { verb: "AttackLakeTown" }), { type: "DeclareDefender" }, made.ctx)).toContain(made.ids.a1);
  });
});

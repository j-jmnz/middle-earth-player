import { describe, expect, it } from "vitest";

import { expectOk } from "../../core/test-fixture.ts";
import { legalTargets, reduce } from "../../engine/reduce.ts";
import type { ScenarioState } from "../../core/state.ts";
import { actionWindow, record, table, type Table } from "./fixture.ts";

// Rules: rr.ranged, rr.step-6-8b (data/rules/entries.json); ledger line 03032:A:2.
// Goblin Archer's flag `attackableByRanged`: only characters with ranged, of any player, may be declared as attackers against it in the staging area.

const FLAG = record("orc:constant:1", "orc", "constant", [{ verb: "ModifyStat", stat: "attackableByRanged", amount: 1, until: "whileSourceInPlay", target: "self" }], { lines: ["orc:A:2"] });

// The constants apply once a step has run (a Pass in the action window), then the player attack window opens again.
function opened(built: Table): ScenarioState {
  const synced = expectOk(reduce(actionWindow(built.state), { type: "Pass" }, built.ctx)).state;
  return { ...synced, mode: "playerAttacks" as const, window: { kind: "playerAttack" as const }, activeSeat: 0, passed: [] };
}

describe("03032:A:2 characters with ranged attack the enemy in the staging area", () => {
  const rows = [
    { code: "aragorn", at: { zone: "heroes", seat: 0 } },
    { code: "archer", at: { zone: "heroes", seat: 0 } },
    { code: "archer", as: "far", at: { zone: "heroes", seat: 1 } },
    { code: "orc", at: { zone: "staging" } },
  ] as const;

  it("03032:A:2 offers the enemy to a ranged character of either player and to no other", () => {
    const built = table(rows, [FLAG], [], 2);
    const { ids, ctx } = built;
    const state = opened(built);
    expect(legalTargets(state, { type: "DeclareAttackers", cardId: ids.archer! }, ctx)).toEqual([ids.orc]);
    expect(legalTargets(state, { type: "DeclareAttackers", cardId: ids.far! }, ctx)).toEqual([ids.orc]);
    expect(legalTargets(state, { type: "DeclareAttackers", cardId: ids.aragorn! }, ctx)).toEqual([]);
  });

  it("03032:A:2 takes ranged characters together, and refuses one without ranged", () => {
    const built = table(rows, [FLAG], [], 2);
    const { ids, ctx } = built;
    const state = opened(built);
    expect(reduce(state, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!] }, ctx).ok).toBe(false);
    const attacked = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.archer!, ids.far!] }, ctx)).state;
    expect(attacked.cards[ids.orc!]?.damage).toBe(3);
    expect(attacked.cards[ids.orc!]?.zone).toBe("staging");
  });

  it("03032:A:2 is not offered without the flag", () => {
    const built = table(rows, [], [], 2);
    const { ids, ctx } = built;
    const state = opened(built);
    expect(legalTargets(state, { type: "DeclareAttackers", cardId: ids.archer! }, ctx)).toEqual([]);
  });
});

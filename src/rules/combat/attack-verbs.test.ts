// Rules: ltp.undefended-attack, rr.multiple-defenders (data/rules/entries.json); ledger line 00007:A:2, "Remove all defending characters from combat. This attack is considered undefended."
import { describe, expect, it } from "vitest";

import { idleScenario } from "../core/test-fixture.ts";
import type { ScenarioState } from "../core/state.ts";
import { declaredDefenders } from "../families/defense/defenders.ts";
import { runAttackVerb } from "./attack-verbs.ts";

const defended: ScenarioState = { ...idleScenario(1), pendingAttack: { enemyId: "e", seat: 0, defenderId: "d1", defense: { extra: ["d2"], damageTo: "d1" } } };

describe("ConsiderUndefended", () => {
  it("with removeDefenders takes every declared defender out of the attack for good, and the attack is undefended (00007:A:2)", () => {
    const next = runAttackVerb(defended, { verb: "ConsiderUndefended", removeDefenders: true }, { seat: 0, sourceId: null }, []);
    const attack = next.pendingAttack;
    expect(attack?.undefended).toBe(true);
    expect(declaredDefenders(attack ?? null)).toEqual([]);
    expect(attack?.removedDefenders).toEqual(["d1", "d2"]);
  });

  it("without it only marks the attack undefended, as the other records read (141040:A:2)", () => {
    const next = runAttackVerb(defended, { verb: "ConsiderUndefended" }, { seat: 0, sourceId: null }, []);
    expect(next.pendingAttack).toMatchObject({ undefended: true, defenderId: "d1" });
  });
});

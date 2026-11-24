// Rules: rr.step-6-4-1, rr.step-6-4-2, rr.step-6-4-3, ltp.undefended-attack (data/rules/entries.json).
// The defending player leaves an attack undefended before the shadow card is turned up, and assigns its damage to a hero after the shadow effect.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";

import { cardMap, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { legalIntents, legalTargets, reduce } from "../engine/reduce.ts";
import { blankScenario, withThreat, type ScenarioState } from "../core/state.ts";
import { spawn } from "../core/zones.ts";

// One seat with two heroes, an Orc engaged with it and one card in the encounter deck to be its shadow card, as the engagement step ends.
function engaged(): { state: ScenarioState; ids: Record<string, string> } {
  let state = blankScenario({ seatCount: 1, seed: 6, definition: fixtureDefinition(["stage"]) });
  const ids: Record<string, string> = {};
  const rows = [
    { code: "aragorn", at: { zone: "heroes", seat: 0 } },
    { code: "gimli", at: { zone: "heroes", seat: 0 } },
    { code: "orc", at: { zone: "engaged", seat: 0 } },
    { code: "shade", at: { zone: "encounterDeck" } },
  ] as const;
  for (const row of rows) {
    const spawned = spawn(state, row.code, row.at);
    state = spawned.state;
    ids[row.code] = spawned.id;
  }
  return { state: { ...withThreat(state, 0, 20), phase: "Encounter", mode: "optionalEngage", window: { kind: "optionalEngage" }, activeSeat: 0, passed: [] }, ids };
}

describe("an undefended attack", () => {
  it("names the hero of an undefended attack after the shadow effect (rr.step-6-4-1, rr.step-6-4-2, rr.step-6-4-3)", () => {
    const effect: Effect = { id: "shade:shadow:1", cardCode: "shade", lines: ["fixture:A:1"], timing: "shadow", instructions: [{ verb: "DealDamage" }] };
    const orc = definePrinted({ code: "orc", name: "Orc", type: "enemy", attack: 2, defense: 0, health: 8, engagementCost: 20, threat: 1 });
    const ctx = { effects: [effect], cards: cardMap([orc, hero("aragorn", "leadership", 10, 1), hero("gimli", "leadership", 10, 1), definePrinted({ code: "shade", name: "Shade", type: "treachery" })]) };
    const { state, ids } = engaged();
    const aragorn = ids.aragorn ?? "";
    const gimli = ids.gimli ?? "";
    const opened = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
    expect(legalTargets(opened.state, { type: "Undefended" }, ctx)).toEqual([aragorn, gimli]);
    // 6.4.1: the attack is left undefended with no hero named. The shadow effect resolves, and no hero is damaged yet.
    const left = expectOk(reduce(opened.state, { type: "Undefended" }, ctx));
    expect(left.steps.some((step) => step.kind === "pop" && step.frame === "shadow")).toBe(true);
    expect(left.state.cards[ids.shade ?? ""]?.face).toBe("up");
    expect(left.steps.some((step) => step.kind === "strike")).toBe(false);
    expect([left.state.cards[aragorn]?.damage, left.state.cards[gimli]?.damage]).toEqual([0, 0]);
    // 6.4.3: the defending player assigns the damage now, and must name the hero.
    expect(left.state.window).toEqual({ kind: "defense", enemyId: ids.orc, seat: 0 });
    expect(legalIntents(left.state, ctx)).toEqual([{ type: "Undefended" }]);
    expect(legalTargets(left.state, { type: "Undefended" }, ctx)).toEqual([aragorn, gimli]);
    expect(reduce(left.state, { type: "Undefended" }, ctx)).toMatchObject({ ok: false, reason: "Choose a hero" });
    const hit = expectOk(reduce(left.state, { type: "Undefended", heroId: gimli }, ctx));
    expect(hit.steps.some((step) => step.kind === "push" && step.frame === "shadow")).toBe(false);
    expect(hit.steps.filter((step) => step.kind === "strike")).toEqual([expect.objectContaining({ targetId: gimli, attack: 2, undefended: true })]);
    expect([hit.state.cards[aragorn]?.damage, hit.state.cards[gimli]?.damage]).toEqual([0, 2]);
    expect(hit.state.pendingAttack).toBeNull();
    // A hero named with the declaration stands: the attack resolves to its end.
    const early = expectOk(reduce(opened.state, { type: "Undefended", heroId: aragorn }, ctx));
    expect([early.state.cards[aragorn]?.damage, early.state.cards[gimli]?.damage]).toEqual([2, 0]);
    expect(early.state.pendingAttack).toBeNull();
  });
});

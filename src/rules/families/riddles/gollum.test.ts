// Rules: hob.riddle-area, hob.riddles, rr.step-6-4-1, rr.step-6-4-3, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 131074:A:1, 131030:B:3, 131031:B:2. Gollum's attack on Bilbo Baggins when a riddle is failed, and who may defend.
import { describe, expect, it } from "vitest";

import { legalIntents, reduce } from "../../engine/reduce.ts";
import { ruleCause } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import type { EngineStep } from "../../core/intents.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { idOf, legalTargets, revealFromTop, send, type Run } from "../../../../test/harness/scene-kit.ts";
import { assignDamage } from "../south/damage.ts";
import { beginEnemyAttack } from "../../combat/combat.ts";
import { riddleTable, type RiddleTable } from "./fixture.ts";

// Wild Wargs is revealed, the riddle answered naming "ally" with a deck of non-allies, so it fails.
function failedRiddle(made: RiddleTable) {
  const steps: EngineStep[] = [];
  let run = { state: revealFromTop(made.state, made.ctx, "131076", steps).state, steps };
  for (const pick of ["answer", "ally"]) run = send(run, { type: "Choose", optionId: pick }, made.ctx);
  // The action window before the defender is declared (rr.step-6-4-1) closes when every player passes.
  for (let guard = 0; guard < 6 && run.state.window?.kind === "frameAction"; guard += 1) run = send(run, { type: "Pass" }, made.ctx);
  return run;
}

// The windows of the rest of the attack close when every player passes.
function passAttack(run: Run, ctx: RiddleTable["ctx"]): Run {
  let current = run;
  for (let guard = 0; guard < 12 && current.state.pendingAttack != null; guard += 1) current = send(current, { type: "Pass" }, ctx);
  return current;
}

describe("Gollum attacks Bilbo (131074:A:1)", () => {
  it("attacks the first player's seat after a riddle with no match, with no shadow card and only Bilbo to defend", () => {
    const made = riddleTable({ deckOf: ["01040", "01040"] });
    const run = failedRiddle(made);
    const attack = run.state.pendingAttack;
    expect(attack?.enemyId).toBe(idOf(run.state, "131074"));
    expect(attack?.seat).toBe(0);
    expect(attack?.onlyHeroes).toEqual([made.bilbo]);
    expect(run.state.cards[idOf(run.state, "131074")]?.shadowId).toBeNull();
    expect(run.state.window?.kind).toBe("defense");
    expect(legalTargets(run.state, { type: "DeclareDefender" }, made.ctx)).toEqual([made.bilbo]);
  });

  it("deals the damage of an undefended attack to Bilbo, the only hero in the area, and leaves Gollum in the riddle area", () => {
    const made = riddleTable({ deckOf: ["01040", "01040"] });
    const run = failedRiddle(made);
    const hit = passAttack(send(run, { type: "Undefended", heroId: made.bilbo }, made.ctx), made.ctx);
    expect(hit.state.cards[made.bilbo]?.damage).toBe(2);
    expect(hit.state.cards[idOf(hit.state, "131074")]?.zone).toBe("riddleArea");
    expect(hit.state.pendingAttack).toBeNull();
  });

  it("exhausts Bilbo when he defends", () => {
    const made = riddleTable({ deckOf: ["01040", "01040"] });
    const run = failedRiddle(made);
    const defended = send(run, { type: "DeclareDefender", defenderId: made.bilbo }, made.ctx);
    expect(defended.state.cards[made.bilbo]?.exhausted).toBe(true);
  });

  it("leaves Gollum's attack undefended when Bilbo is exhausted, and deals its damage to Bilbo", () => {
    const made = riddleTable({ deckOf: ["01040", "01040"] });
    const run = failedRiddle(made);
    // Gollum's attack is still pending in the defense window; only Bilbo is exhausted.
    const spent = { ...run, state: updateCard(run.state, made.bilbo, { exhausted: true }) };
    expect(spent.state.pendingAttack?.enemyId).toBe(idOf(spent.state, "131074"));
    expect(spent.state.window?.kind).toBe("defense");
    expect(legalTargets(spent.state, { type: "DeclareDefender" }, made.ctx)).toEqual([]);
    expect(legalIntents(spent.state, made.ctx).some((intent) => intent.type === "Undefended")).toBe(true);
    expect(legalTargets(spent.state, { type: "Undefended" }, made.ctx)).toEqual([made.bilbo]);
    const hit = passAttack(send(spent, { type: "Undefended", heroId: made.bilbo }, made.ctx), made.ctx);
    expect(hit.state.cards[made.bilbo]?.damage).toBe(2);
  });

  it("does not attack when the riddle finds a match", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    const steps: EngineStep[] = [];
    let run = { state: revealFromTop(made.state, made.ctx, "131076", steps).state, steps };
    for (const pick of ["answer", "ally"]) run = send(run, { type: "Choose", optionId: pick }, made.ctx);
    expect(run.state.pendingAttack).toBeNull();
  });
});

describe("Bilbo takes damage only from Gollum while he is in the riddle area (hob.riddle-area)", () => {
  it("takes no damage from another card's effect, and takes the damage of Gollum's attack", () => {
    const made = riddleTable();
    const hurt = placeDamage(made.state, made.bilbo, 2, made.ctx.cards, [], "framework", ruleCause("rr.damage"), idOf(made.state, "f0"));
    expect(hurt.cards[made.bilbo]?.damage).toBe(0);
    const byGollum = placeDamage(made.state, made.bilbo, 2, made.ctx.cards, [], "framework", ruleCause("rr.damage"), idOf(made.state, "131074"));
    expect(byGollum.cards[made.bilbo]?.damage).toBe(2);
    expect(placeDamage(made.state, made.hero, 2, made.ctx.cards, [], "framework", ruleCause("rr.damage"), idOf(made.state, "f0")).cards[made.hero]?.damage).toBe(2);
  });
});

// The state with Bilbo as seat 0's only hero, or with one other hero.
function bilboAlone(state: ScenarioState, bilbo: string, other?: string): ScenarioState {
  const [first, second] = state.seats;
  return first && second ? { ...state, seats: [{ ...first, heroes: other ? [other, bilbo] : [bilbo] }, second] } : state;
}

// Wild Wargs (a Creature, not Gollum) is engaged with seat 0 and attacks it at the defense window; `soleBilbo` leaves Bilbo the seat's only hero.
function wargsAttack(layout: { seats?: 1 | 2 }, soleBilbo: boolean) {
  const made = riddleTable({ ...layout, engaged: [{ code: "131076", seat: 0 }] });
  const bare = soleBilbo ? bilboAlone(made.state, made.bilbo) : made.state;
  const steps: EngineStep[] = [];
  let run: Run = { state: beginEnemyAttack(bare, 0, idOf(bare, "131076"), made.ctx, steps, { shadow: false }), steps };
  // The action window before the defender is declared closes when every player passes.
  for (let guard = 0; guard < 6 && run.state.window?.kind === "frameAction"; guard += 1) run = send(run, { type: "Pass" }, made.ctx);
  return { made, state: run.state };
}

describe("an attack of another enemy cannot be put on Bilbo while he is in the riddle area (hob.riddle-area, rr.cannot)", () => {
  for (const seats of [1, 2] as const) {
    it(`offers only the other hero for an undefended attack, ${seats === 1 ? "one player" : "two players"}`, () => {
      const { made, state } = wargsAttack({ seats }, false);
      expect(state.window?.kind).toBe("defense");
      const targets = legalTargets(state, { type: "Undefended" }, made.ctx);
      expect(targets).toContain(made.hero);
      expect(targets).not.toContain(made.bilbo);
      const refused = reduce(state, { type: "Undefended", heroId: made.bilbo }, made.ctx);
      expect(refused.ok).toBe(false);
      const hit = passAttack(send({ state, steps: [] }, { type: "Undefended", heroId: made.hero }, made.ctx), made.ctx);
      expect(hit.state.cards[made.hero]?.damage).toBeGreaterThan(0);
      expect(hit.state.cards[made.bilbo]?.damage).toBe(0);
    });

    it(`still resolves when Bilbo is the only hero, and deals no damage, ${seats === 1 ? "one player" : "two players"}`, () => {
      const { made, state } = wargsAttack({ seats }, true);
      expect(legalTargets(state, { type: "Undefended" }, made.ctx)).toEqual([]);
      const hit = passAttack(send({ state, steps: [] }, { type: "Undefended" }, made.ctx), made.ctx);
      expect(hit.state.pendingAttack).toBeNull();
      expect(hit.state.cards[made.bilbo]?.damage).toBe(0);
    });
  }

  it("keeps Bilbo out of a character chosen to take damage", () => {
    const made = riddleTable({ seats: 2 });
    // Seat 0 has Bilbo and one other hero, so the one left to choose takes the damage with no question.
    const state = bilboAlone(made.state, made.bilbo, made.hero);
    const steps: EngineStep[] = [];
    const asked = assignDamage(state, { verb: "AssignDamage", amount: 1, left: 1, of: 1, pick: { type: "character", control: "you" } }, { seat: 0, sourceId: idOf(state, "f0"), chosen: made.bilbo }, made.ctx, steps);
    expect(asked.cards[made.bilbo]?.damage).toBe(0);
    // Without the filter the chosen Bilbo stays the target and the damage is lost; with it the other hero takes the 1.
    expect(asked.cards[made.hero]?.damage).toBe(1);
  });
});

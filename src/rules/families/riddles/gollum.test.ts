// Rules: hob.riddle-area, hob.riddles, rr.step-6-4-1, rr.step-6-4-3, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 131074:A:1, 131030:B:3, 131031:B:2. Gollum's attack on Bilbo Baggins when a riddle is failed, and who may defend.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../engine/reduce.ts";
import { ruleCause } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import type { EngineStep } from "../../core/intents.ts";
import { updateCard } from "../../core/state.ts";
import { idOf, legalTargets, revealFromTop, send, type Run } from "../../../../test/harness/scene-kit.ts";
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

  it("exhausts Bilbo when he defends, and an exhausted Bilbo leaves the next attack undefended", () => {
    const made = riddleTable({ deckOf: ["01040", "01040"] });
    const run = failedRiddle(made);
    const defended = send(run, { type: "DeclareDefender", defenderId: made.bilbo }, made.ctx);
    expect(defended.state.cards[made.bilbo]?.exhausted).toBe(true);
    const spent = updateCard(defended.state, made.bilbo, { exhausted: true });
    expect(legalIntents({ ...spent, pendingAttack: null }, made.ctx).some((intent) => intent.type === "DeclareDefender")).toBe(false);
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

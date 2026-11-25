// Rules: rr.engaged, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger line 51253:A:1; docs/scenarios/standalone-scenarios/the-mines-of-moria.md (reading 23).
// Massing in the Deep's "Each engaged enemy makes an attack" with The Watcher considered engaged with each player: one attack for each seat.
import { describe, expect, it } from "vitest";

import { first, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { effectData } from "../../../rules/families/encounter/moves.ts";

const WATCHER = "51210";
const table = (layout: Layout) => tableFromLayout("the-mines-of-moria", { stage: "51201", progress: 5, staging: [WATCHER], phase: "Encounter", ...layout });

// The seat of the attack made now and of each one queued behind it.
function attacks(seats: 1 | 2, progress: number) {
  const made = table({ seats, progress });
  const run = resolveRecords(made.state, made.ctx, "51253", "whenRevealed");
  const queued = (effectData(run.state)?.queue ?? []).filter((item) => item.instruction.verb === "ImmediateAttackEach").map((item) => item.seat);
  return { pending: run.state.pendingAttack?.seat ?? null, queued, run, watcher: first(made.state, WATCHER) };
}

describe("Massing in the Deep (51253:A:1) with The Watcher considered engaged", () => {
  it("51253:A:1 alone, The Watcher at 5 progress makes one attack", () => {
    const { pending, queued, run, watcher } = attacks(1, 5);
    expect(run.state.pendingAttack?.enemyId).toBe(watcher);
    expect(pending).toBe(0);
    expect(queued).toEqual([]);
  });

  it("51253:A:1 with two players, The Watcher makes one attack on each seat it is considered engaged with", () => {
    const { pending, queued } = attacks(2, 5);
    expect([pending, ...queued].sort()).toEqual([0, 1]);
  });

  it("51253:A:1 below 5 progress The Watcher is engaged with nobody, so no attack is made", () => {
    expect(attacks(2, 4).pending).toBeNull();
  });
});

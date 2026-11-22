// Rules: rr.combat-phase, rr.step-6-2, rr.step-6-4a, rr.step-6-5 (data/rules/entries.json). The conditions the defense
// family adds: where the combat phase is, and the resources the players hold.
import type { Condition } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { heroPays } from "../../player/payments.ts";
import type { Sphere } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

type CombatStep = Extract<Condition, { kind: "combatStep" }>["is"];

// `beforeEnemyAttacks`: the combat phase has not reached the resolving enemy attacks step. `beforeAttacksResolve`: the shadow
// cards are dealt (rr.step-6-2) and no attack has resolved yet (one whose damage is placed has resolved, though it is not over). `afterEnemyAttacks`: the enemy attacks step is complete and
// the players attack (rr.step-6-5).
export function combatStepIs(state: ScenarioState, step: CombatStep): boolean {
  if (state.phase !== "Combat") return false;
  switch (step) {
    case "beforeEnemyAttacks":
      return state.mode === "combatStart" || state.mode === "combatShadows" || state.mode === "combatActions";
    case "beforeAttacksResolve":
      return (state.mode === "combatActions" || state.mode === "enemyAttacks") && state.resolvedAttacks.length === 0 && state.declaredAttacks.length === 0 && state.pendingAttack?.damaged !== true && state.pendingAttack?.awaiting !== "end";
    case "afterEnemyAttacks":
      return state.mode === "playerAttacks";
  }
}

// The resources the heroes of these seats hold that can pay for the sphere (any sphere when null).
export function groupResources(state: ScenarioState, seats: readonly number[], sphere: Sphere | null, ctx: ReduceContext): number {
  let total = 0;
  for (const seat of seats) for (const id of state.seats[seat]?.heroes ?? []) if (heroPays(state, id, sphere, ctx)) total += state.cards[id]?.resources ?? 0;
  return total;
}

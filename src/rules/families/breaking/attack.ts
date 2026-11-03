// Rules: mec109.multiple-staging-areas, rr.step-6-4b (data/rules/entries.json); the shadow cards and enemies of Breaking of the Fellowship (142069, 142079, 142081, 142082).
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret.ts";
import { printedOf } from "../../printed.ts";
import type { ScenarioState } from "../../state.ts";

// The pick filters the breaking family adds that read the attack in progress: a character with fewer printed hit points than the enemy making it ("if the
// defending character has fewer printed hit points than the attacking enemy"). False with no attack in progress.
export function breakingPickMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext): boolean {
  if (!spec.fewerHitPointsThan) return true;
  const attacker = state.pendingAttack?.enemyId ? state.cards[state.pendingAttack.enemyId] : undefined;
  const card = state.cards[id];
  if (!attacker || !card) return false;
  const own = printedOf(ctx.cards, card.code).health;
  const theirs = printedOf(ctx.cards, attacker.code).health;
  return own != null && theirs != null && own < theirs;
}

// Rules: mec112.wizardry, rr.shadow-effects, rr.forced (data/rules/entries.json); ledger lines 143047:A:2, 143052:A:1.
//
// "When ~ is dealt a shadow card with a Wizardry effect": announced about the attacking enemy once for each of its shadow cards that prints a Wizardry line, as the shadow cards of its attack are flipped
// (the shadow step, rr.step-6-4-2), before damage is dealt, and only when some card hears it. A shadow card dealt but never flipped is not announced. The Wizardry line of the shadow card does nothing by
// itself: a shadow card has only its Shadow text active.
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { shadowCards } from "../../core/zones.ts";
import { listened, queueHeard } from "../defense/listen.ts";
import { wizardryOf } from "./trigger.ts";

export function announceShadowWizardry(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = attack ? state.cards[attack.enemyId] : undefined;
  if (!attack || !enemy || !listened(state, ctx, ["shadowWizardry"])) return state;
  let next = state;
  for (const shadowId of shadowCards(enemy)) {
    const shadow = state.cards[shadowId];
    if (!shadow || shadow.face !== "up" || wizardryOf(ctx, shadow.code).length === 0) continue;
    next = queueHeard(next, ctx, { trigger: "shadowWizardry", seat: attack.seat, cardId: enemy.id, subject: enemy.id, other: shadowId });
  }
  return next;
}

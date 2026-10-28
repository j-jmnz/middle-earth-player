// Rules: rr.shadow-effects, rr.step-6-4-2, rr.forced (data/rules/entries.json); ledger line 01102:A:3.
//
// "After a shadow effect dealt to ~ resolves": announced about the attacking enemy once for each of its shadow cards that has an effect, after the
// shadow cards of its attack have resolved and before damage is dealt, and only when some card hears it.
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import { shadowCards } from "../zones.ts";
import { listened, queueHeard } from "./defense-listen.ts";

export function announceShadowResolved(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = attack ? state.cards[attack.enemyId] : undefined;
  if (!attack || !enemy || attack.shadowCanceled || !listened(state, ctx, ["shadowEffectResolved"])) return state;
  let next = state;
  for (const shadowId of shadowCards(enemy)) {
    const code = state.cards[shadowId]?.code;
    if (!code || !ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "shadow")) continue;
    next = queueHeard(next, ctx, { trigger: "shadowEffectResolved", seat: attack.seat, cardId: enemy.id, subject: enemy.id, other: shadowId });
  }
  return next;
}

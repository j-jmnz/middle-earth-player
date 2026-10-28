// Rules: rr.shadow-effects, rr.step-6-4-2, rr.forced (data/rules/entries.json); ledger line 01102:A:3.
//
// "After a shadow effect dealt to ~ resolves": announced about the attacking enemy once the shadow cards of its attack have resolved,
// before damage is dealt, and only when its shadow card has an effect and some card hears it.
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import { listened, queueHeard } from "./defense-listen.ts";

export function announceShadowResolved(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = attack ? state.cards[attack.enemyId] : undefined;
  const shadow = enemy?.shadowId ? state.cards[enemy.shadowId] : undefined;
  if (!attack || !enemy || !shadow || attack.shadowCanceled || !listened(state, ctx, ["shadowEffectResolved"])) return state;
  if (!ctx.effects.some((effect) => effect.cardCode === shadow.code && effect.timing === "shadow")) return state;
  return queueHeard(state, ctx, { trigger: "shadowEffectResolved", seat: attack.seat, cardId: enemy.id, subject: enemy.id });
}

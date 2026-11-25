// Conditions that read what the running effect or the answered event carries (the scope's `x`, `dealt`, `excess`, `returned`, flags) and the stack.
import { discardedCost } from "../../families/uncharted/cards.ts";
import { modifiedStat } from "../../core/modified-stat.ts";
import { shadowCards } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ConditionHandlers } from "../condition-scope.ts";
import type { ReduceContext } from "../interpret.ts";

/** Whether the enemy holds a shadow card with no shadow effect. */
export function shadowBlankOf(state: ScenarioState, enemyId: string | null, ctx: Pick<ReduceContext, "effects">): boolean {
  return shadowCards(enemyId ? state.cards[enemyId] : undefined).some((id) => {
    const code = state.cards[id]?.code;
    return code != null && !ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "shadow");
  });
}

export const eventHandlers = {
  noneReturned: (_state, _condition, scope) => scope.returned === 0,
  returnedBelow: (_state, condition, scope) => scope.returned < condition.than,
  x: (_state, condition, scope) => (scope.x ?? 0) >= condition.min,
  xReachesRemaining: (state, _condition, scope, ctx) => {
    const picked = scope.picked?.at(-1);
    const card = picked ? state.cards[picked] : undefined;
    return card != null && (scope.x ?? 0) >= modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage;
  },
  byPlayerCard: (_state, _condition, scope) => scope.byPlayerCard === true,
  fromStaging: (_state, _condition, scope) => scope.fromStaging === true,
  exhaustedToDefend: (_state, _condition, scope) => scope.exhaustedToDefend === true,
  excess: (_state, condition, scope) => (scope.excess ?? 0) >= condition.min,
  dealt: (_state, condition, scope) => (scope.dealt ?? 0) >= (condition.min ?? 1),
  damageReached: (state, condition, scope) => {
    const damage = scope.sourceId ? (state.cards[scope.sourceId]?.damage ?? 0) : 0;
    return damage >= condition.nth && damage - (scope.dealt ?? 0) < condition.nth;
  },
  // Decided when the location left play (destroyCard), while its attachments still gave their quest points.
  subjectExplored: (_state, _condition, scope) => scope.explored === true,
  copiesPlayedThisRound: (state, condition, scope) => {
    const code = scope.sourceId ? state.cards[scope.sourceId]?.code : undefined;
    const plays = (state.played ?? []).filter((entry) => entry.round === state.round && entry.code === code && (!condition.you || entry.seat === scope.actor));
    // The card's own latest play is not another copy; an earlier play of the same card (returned to the hand) is.
    const played = plays.length - (plays.some((entry) => entry.id === scope.sourceId) ? 1 : 0);
    return played <= condition.max;
  },
  discardedCost: (state, condition, _scope, ctx) => discardedCost(state, ctx) <= condition.max,
  revealing: (state, _condition, scope) => state.stack.some((frame) => frame.frame === "whenRevealed" && frame.cardId === scope.sourceId),
  shadowBlank: (state, _condition, scope, ctx) => scope.shadowBlank === true || shadowBlankOf(state, scope.sourceId, ctx),
} satisfies Partial<ConditionHandlers>;

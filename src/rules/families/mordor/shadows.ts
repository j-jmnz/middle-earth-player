// Rules: rr.shadow-effects, rr.step-6-2, rr.step-6-4-2 (data/rules/entries.json); ledger lines 21032:A:2, 21032:A:3.
// Black Númenórean keeps the shadow cards dealt to him that have a shadow effect, faceup, and resolves their shadow effects again at each attack.
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, updateCard } from "../../core/state.ts";
import { shadowCards } from "../../core/zones.ts";
import { frameScope } from "../../interpret/amounts.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";

const hasShadowEffect = (state: ScenarioState, ctx: ReduceContext, id: string): boolean => ctx.effects.some((effect) => effect.cardCode === state.cards[id]?.code && effect.timing === "shadow");

/** Whether the shadow card is one an enemy keeps past the combat phase (KeepDealtShadow): the end-of-phase discard leaves it. */
export const keptShadow = (state: ScenarioState, shadowId: string): boolean => state.modifiers.length > 0 && flagged(state, shadowId, "keptShadow");

/** KeepDealtShadow: the shadow card just dealt to the source takes the enemy's first place (the card its attack resolves; the cards it held stay faceup beside it), and a card with a shadow effect is kept. */
export function keepDealtShadow(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const dealt = frameScope(state, focus.seat, focus.sourceId).other;
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!dealt || !enemy || state.cards[dealt]?.zone !== "shadow" || !shadowCards(enemy).includes(dealt)) return state;
  const first = enemy.shadowId && enemy.shadowId !== dealt ? enemy.shadowId : null;
  const placed = first ? updateCard(state, enemy.id, { shadowId: dealt, extraShadowIds: [first, ...(enemy.extraShadowIds ?? []).filter((id) => id !== dealt)] }) : state;
  return hasShadowEffect(placed, ctx, dealt) ? { ...placed, modifiers: [...placed.modifiers, { instanceId: dealt, sourceId: enemy.id, stat: "keptShadow", amount: 1, until: "endOfGame" }] } : placed;
}

/** ResolveHeldShadowEffects: the faceup shadow cards of the source that have a shadow effect, but the one dealt for this attack (the engine resolved it), resolve it against the attack in progress, in the order dealt, the defending player resolving them (each a frame on top of the stack, so the last one pushed resolves first). */
export function resolveHeldShadowEffects(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!attack || !enemy || attack.enemyId !== enemy.id) return state;
  const held = shadowCards(enemy).filter((id) => state.cards[id]?.zone === "shadow" && id !== enemy.shadowId && state.cards[id]?.face === "up" && hasShadowEffect(state, ctx, id));
  return [...held].reverse().reduce((next, id) => pushCardEffects(next, "ResolveEffect", id, attack.seat, false, ctx.effects.filter((effect) => effect.cardCode === next.cards[id]?.code && effect.timing === "shadow"), ctx, steps), state);
}

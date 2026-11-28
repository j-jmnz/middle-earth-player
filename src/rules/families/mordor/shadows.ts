// Rules: rr.shadow-effects, rr.step-6-2, rr.step-6-4-2 (data/rules/entries.json); ledger lines 21032:A:2, 21032:A:3.
// Black Númenórean keeps the shadow cards dealt to him that have a shadow effect, faceup, and resolves their shadow effects again at each attack.
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, updateCard } from "../../core/state.ts";
import { shadowCards } from "../../core/zones.ts";
import { cardHasShadowEffect } from "../../combat/shadow.ts";
import { frameScope } from "../../interpret/amounts.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";

// The keptShadow mark's amount: 1 while the card has not yet been through an attack's shadow resolution, 2 once it has (it is faceup and resolved by the engine itself).
const KEPT = 1;
const RESOLVED = 2;

/** Whether the shadow card is one an enemy keeps past the combat phase (KeepDealtShadow): the end-of-phase discard leaves it. */
export const keptShadow = (state: ScenarioState, shadowId: string): boolean => state.modifiers.length > 0 && flagged(state, shadowId, "keptShadow");

/** Whether the enemy holds a kept shadow card, so its attack announces `shadowsResolved` even when the new card's shadow effect was canceled (21032:A:3 does not depend on that effect). */
export const holdsKeptShadow = (state: ScenarioState, enemyId: string): boolean => state.modifiers.length > 0 && shadowCards(state.cards[enemyId]).some((id) => keptShadow(state, id));

/** KeepDealtShadow: the shadow card just dealt to the source takes the enemy's first place (the card its attack resolves; the cards it held stay faceup beside it), and a card with a shadow effect is kept. */
export function keepDealtShadow(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const dealt = frameScope(state, focus.seat, focus.sourceId).other;
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!dealt || !enemy || state.cards[dealt]?.zone !== "shadow" || !shadowCards(enemy).includes(dealt)) return state;
  const first = enemy.shadowId && enemy.shadowId !== dealt ? enemy.shadowId : null;
  const placed = first ? updateCard(state, enemy.id, { shadowId: dealt, extraShadowIds: [first, ...(enemy.extraShadowIds ?? []).filter((id) => id !== dealt)] }) : state;
  return cardHasShadowEffect(placed, dealt, ctx) ? { ...placed, modifiers: [...placed.modifiers, { instanceId: dealt, sourceId: enemy.id, stat: "keptShadow", amount: KEPT, until: "endOfGame" }] } : placed;
}

const resolvedBefore = (state: ScenarioState, id: string): boolean => state.modifiers.some((modifier) => modifier.stat === "keptShadow" && modifier.instanceId === id && modifier.amount === RESOLVED);

/** ResolveHeldShadowEffects: the kept shadow cards of the source that were faceup and resolved before this attack (not the one dealt for it, nor one the engine turned up in it), resolve their shadow effect against the attack in progress, in the order dealt, the defending player resolving them (each a frame on top of the stack, so the last one pushed resolves first). Every kept card is then marked as resolved. */
export function resolveHeldShadowEffects(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!attack || !enemy || attack.enemyId !== enemy.id) return state;
  const kept = shadowCards(enemy).filter((id) => keptShadow(state, id));
  const held = kept.filter((id) => state.cards[id]?.zone === "shadow" && state.cards[id]?.face === "up" && resolvedBefore(state, id));
  const marked: ScenarioState = { ...state, modifiers: state.modifiers.map((modifier) => (modifier.stat === "keptShadow" && kept.includes(modifier.instanceId) && state.cards[modifier.instanceId]?.face === "up" ? { ...modifier, amount: RESOLVED } : modifier)) };
  return [...held].reverse().reduce((next, id) => pushCardEffects(next, "ResolveEffect", id, attack.seat, false, ctx.effects.filter((effect) => effect.cardCode === next.cards[id]?.code && effect.timing === "shadow"), ctx, steps), marked);
}

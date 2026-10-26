// Rules: rr.step-6-2, rr.step-6-4-2, rr.shadow-effects, faq.additional-attacks (data/rules/entries.json). Shadow cards in
// the defense family: looking at one, discarding one, dealing another, dealing them face up, and telling when one raised the
// attacking enemy's Attack.
import type { ReduceContext } from "../interpret.ts";
import { dealAdditionalShadow } from "../interpret.ts";
import { modifiedStat } from "../keywords.ts";
import { effectsOf } from "../listen.ts";
import type { CardFace, ScenarioState } from "../state.ts";
import { flagged, livingSeats, updateCard } from "../state.ts";
import { patchTop, topFrame } from "../windows.ts";
import { moveCard, shadowCards } from "../zones.ts";
import { withDefense } from "./defense-defenders.ts";
import { listened, queueHeard } from "./defense-listen.ts";

// The first shadow card dealt to the enemy that is still face down.
export function facedownShadow(state: ScenarioState, enemyId: string): string | undefined {
  return shadowCards(state.cards[enemyId]).find((id) => state.cards[id]?.face === "down");
}

export function hasShadowEffect(state: ScenarioState, shadowId: string, ctx: ReduceContext): boolean {
  const code = state.cards[shadowId]?.code;
  return code != null && effectsOf(ctx, code).some((effect) => effect.timing === "shadow");
}

// LookAtShadow: the actor sees a facedown shadow card of the enemy (a look window, closed with a pass). With `markEffect` the
// running effect's X becomes 1 when that card has a shadow effect, else 0.
export function lookAtShadow(state: ScenarioState, enemyId: string, seat: number, markEffect: boolean, ctx: ReduceContext): ScenarioState {
  const shadowId = facedownShadow(state, enemyId);
  const data = topFrame(state)?.data;
  const marked = markEffect && data?.kind === "effect" ? patchTop(state, { data: { ...data, x: shadowId && hasShadowEffect(state, shadowId, ctx) ? 1 : 0 } }) : state;
  if (!shadowId) return marked;
  return { ...marked, window: { kind: "look", seat, cardIds: [shadowId] }, activeSeat: seat, passed: [] };
}

// DiscardShadowOf: a facedown shadow card of the enemy goes to the encounter discard pile, or its face-up one when it has none.
export function discardShadowOf(state: ScenarioState, enemyId: string): ScenarioState {
  const shadowId = facedownShadow(state, enemyId) ?? shadowCards(state.cards[enemyId])[0];
  return shadowId ? moveCard(state, shadowId, { zone: "encounterDiscard" }) : state;
}

// DealShadowTo: one more shadow card for an engaged enemy; during its attack it resolves after those it has (rr.step-6-4-2).
export function dealShadowTo(state: ScenarioState, enemyId: string): ScenarioState {
  return state.cards[enemyId]?.zone === "engaged" ? dealAdditionalShadow(state, enemyId) : state;
}

// How a shadow card is dealt to the enemy: face up while the player it is engaged with holds shadowsFaceUp (Silver Lamp,
// 07009), for its first shadow card; an additional one stays face down until its attack resolves it.
export function shadowFace(state: ScenarioState, enemyId: string): CardFace {
  const enemy = state.cards[enemyId];
  if (!enemy || enemy.shadowId || enemy.controller == null || enemy.zone !== "engaged") return "down";
  return flagged(state, `seat:${enemy.controller}`, "shadowsFaceUp") ? "up" : "down";
}

// After the shadow cards are dealt (rr.step-6-2), each player with an engaged enemy that was dealt one hears it.
export function announceShadowsDealt(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!listened(state, ctx, ["shadowsDealt"])) return state;
  let next = state;
  for (const seat of livingSeats(state)) {
    if ((state.seats[seat]?.engaged ?? []).some((id) => state.cards[id]?.shadowId)) next = queueHeard(next, ctx, { trigger: "shadowsDealt", seat });
  }
  return next;
}

// The attacking enemy's Attack as its shadow cards begin to resolve, kept while a card listens for a shadow card raising it.
export function noteShadowStart(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = attack ? state.cards[attack.enemyId] : undefined;
  if (!attack || !enemy || attack.shadowResolved || attack.defense?.attackBefore != null || !listened(state, ctx, ["shadowRaisedAttack"])) return state;
  return { ...state, pendingAttack: withDefense(attack, { attackBefore: modifiedStat(state, enemy, "attack", ctx.cards) }) };
}

// The shadow cards have resolved: when they increased the attacking enemy's Attack, "When a shadow card increases an enemy's
// Attack" is announced (the other card is the defender).
export function announceShadowRaise(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = attack ? state.cards[attack.enemyId] : undefined;
  const before = attack?.defense?.attackBefore;
  if (!attack || !enemy || before == null || modifiedStat(state, enemy, "attack", ctx.cards) <= before) return state;
  const defender = attack.defenderId && !attack.undefended ? { other: attack.defenderId } : {};
  return queueHeard(state, ctx, { trigger: "shadowRaisedAttack", seat: attack.seat, cardId: enemy.id, subject: enemy.id, ...defender });
}

// RedirectAttack: the attacking enemy's shadow card is turned face up; with no shadow effect on it, the attack is resolved
// against the chosen enemy instead (Small Target, 06062).
export function redirectAttack(state: ScenarioState, enemyId: string, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const target = state.cards[enemyId];
  if (!attack || !target || enemyId === attack.enemyId) return state;
  const shadowId = state.cards[attack.enemyId]?.shadowId;
  const revealed = shadowId ? updateCard(state, shadowId, { face: "up" }) : state;
  if (shadowId && hasShadowEffect(state, shadowId, ctx)) return revealed;
  const current = revealed.pendingAttack ?? attack;
  return { ...revealed, pendingAttack: withDefense(current, { redirectTo: enemyId }) };
}

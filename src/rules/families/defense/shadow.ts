// Rules: rr.step-6-2, rr.step-6-4-2, rr.shadow-effects, faq.additional-attacks (data/rules/entries.json). Shadow cards in
// the defense family: looking at one, discarding one, dealing another, dealing them face up, and telling when one raised the
// attacking enemy's Attack.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { dealAdditionalShadow } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { effectsOf } from "../../windows/listen.ts";
import type { CardFace, ScenarioState } from "../../core/state.ts";
import { flagged, livingSeats, updateCard } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { moveCard, shadowCards } from "../../core/zones.ts";
import { withDefense } from "./defenders.ts";
import { listened, queueHeard } from "./listen.ts";

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
// An enemy in the staging area that is considered engaged by threat (Durin's Bane) is dealt one too; `fromEncounter` deals it from the encounter deck, not the Balrog deck (901806:A:1).
// `fromRaven` deals it from the Raven deck (08156:A:2, rm.raven-deck).
// `inPlay`: an enemy in the staging area is in play too and is dealt one ("Deal 1 shadow card to each Ship enemy in play", 12157:A:1; rr.in-play-and-out-of-play).
export function dealShadowTo(state: ScenarioState, enemyId: string, steps: EngineStep[], ctx: ReduceContext, fromEncounter = false, inPlay = false, fromRaven = false): ScenarioState {
  const here = state.cards[enemyId]?.zone === "engaged" || (inPlay && state.cards[enemyId]?.zone === "staging") || (state.modifiers.length > 0 && flagged(state, enemyId, "engagedWithThreatening") && state.cards[enemyId]?.zone === "staging");
  return here ? dealAdditionalShadow(state, enemyId, steps, ctx, fromEncounter, fromRaven) : state;
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
  return resolveAgainst(revealed, enemyId);
}

// The attack in progress is resolved against the enemy `enemyId` instead of the defenders: that enemy takes the damage, read against its Defense (specialStrike). The attacking enemy is never its own target.
// A shadow effect that says "resolve this attack against that enemy" (146023:A:2) does this once its shadow card is revealed; RedirectAttack does it when the shadow card it revealed has no effect.
export function resolveAgainst(state: ScenarioState, enemyId: string): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !state.cards[enemyId] || enemyId === attack.enemyId) return state;
  return { ...state, pendingAttack: withDefense(attack, { redirectTo: enemyId }) };
}

// Rules: rr.response, rr.timing-of-ability-resolution, rr.cancel, rr.attack-resolution-chart (data/rules/entries.json).
// When an enemy attack waits for the Responses to something that just happened in it, and when a queued event waits for the
// damage it follows to be answered. Every wait here is taken only when some card could answer, so a table without such cards
// plays exactly as before.
import type { Trigger } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { dealOneShadow, type ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import { queueEvent } from "../../windows/queue.ts";
import { discardShadowOf } from "../../combat/shadow.ts";
import type { GameEvent, PendingAttack, ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";

// Some card in play or in a hand has a Response, Forced or triggered effect on one of these triggers.
export function listened(state: ScenarioState, ctx: ReduceContext, triggers: readonly Trigger[]): boolean {
  if (ctx.effects.length === 0) return false;
  return Object.values(state.cards).some(
    (card) => (inPlay(card.zone) || card.zone === "hand") && effectsOf(ctx, card.code).some((effect) => effect.trigger != null && triggers.includes(effect.trigger)),
  );
}

// Queues the event when some card could hear its trigger; otherwise the state is unchanged.
export function queueHeard(state: ScenarioState, ctx: ReduceContext, event: GameEvent): ScenarioState {
  return listened(state, ctx, [event.trigger]) ? queueEvent(state, event) : state;
}

// An attack outside the combat phase is dealt a shadow card of its own; one dealt for an earlier attack is discarded first
// (rr.attacks-outside-the-combat-phase, faq.additional-attacks). A card just dealt is heard as in the combat phase ("look at 1
// shadow card that was just dealt to an enemy attacking you", 01071:A:2).
export function dealAttackShadow(state: ScenarioState, enemyId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cleared = discardShadowOf(state, enemyId);
  const dealt = dealOneShadow(cleared, enemyId, steps, ctx);
  const seat = state.cards[enemyId]?.controller ?? null;
  return dealt.cards[enemyId]?.shadowId != null && seat != null ? queueHeard(dealt, ctx, { trigger: "shadowsDealt", seat }) : dealt;
}

// The attack waits, with no window open, until the queued events on these triggers have been announced and everything they
// started has resolved; then `then` follows (resumeAttack). Null when no such event is queued or no card could hear it.
export function holdAttack(state: ScenarioState, ctx: ReduceContext, then: NonNullable<PendingAttack["awaiting"]>, triggers: readonly Trigger[]): ScenarioState | null {
  const attack = state.pendingAttack;
  if (!attack || !(state.pendingEvents ?? []).some((event) => triggers.includes(event.trigger))) return null;
  if (!listened(state, ctx, triggers)) return null;
  return { ...state, pendingAttack: { ...attack, awaiting: then, awaitDepth: state.stack.length } };
}

// The follow-ups of damage ("After ~ takes damage") wait while the damage they follow is still being answered: its
// `damageDealt` Responses are offered or one of them is resolving (rr.cancel). The queue waits behind them, in order.
const FOLLOW_UPS: ReadonlySet<Trigger> = new Set<Trigger>(["damaged", "damagedByAttack"]);

export function eventWaits(state: ScenarioState): boolean {
  const first = state.pendingEvents?.[0];
  if (!first || !FOLLOW_UPS.has(first.trigger) || !first.cardId) return false;
  const id = first.cardId;
  return state.stack.some(
    (frame) =>
      ((frame.data.kind === "responses" || frame.data.kind === "event") && frame.data.event.trigger === "damageDealt" && frame.data.event.cardId === id) ||
      (frame.data.kind === "effect" && frame.data.hold === id),
  );
}

// Damage that was canceled is no longer "taken": the queued follow-ups of that card lose that much, and go when nothing is left.
export function trimFollowUps(state: ScenarioState, id: string, canceled: number): ScenarioState {
  const pending = state.pendingEvents ?? [];
  if (canceled <= 0 || !pending.some((event) => FOLLOW_UPS.has(event.trigger) && event.cardId === id)) return state;
  const kept = pending.flatMap((event) => {
    if (!FOLLOW_UPS.has(event.trigger) || event.cardId !== id) return [event];
    const left = (event.amount ?? 0) - canceled;
    return left > 0 ? [{ ...event, amount: left }] : [];
  });
  return { ...state, pendingEvents: kept };
}

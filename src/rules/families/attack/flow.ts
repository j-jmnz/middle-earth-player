// Rules: rr.step-6-8b, rr.step-6-8-1, rr.step-6-8-4, rr.attack-resolution-chart, rr.attacks-outside-the-combat-phase,
// rr.lasting-effects, rr.delayed-effects, faq.limitations-on-attacks (data/rules/entries.json).
//
// The life of a player attack beyond strength and damage: its declaration (what it remembers, the bonuses its attackers kept for
// their next attack), the wait for the Responses to that declaration, and its end (6.8.4): "for this attack" expires, the
// attackers hear that they attacked, the effects delayed to the end of the attack resolve, and the window it came from (or
// the attack it was declared during) goes on.
import { noteAttackers } from "../aflame/attack.ts";
import type { Modifier } from "../../windows/frame-types.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import { heard, strikeWaits } from "./events.ts";
import type { PendingStrike, ScenarioState, Window } from "../../core/state.ts";
import { pushFrame } from "../../windows/windows.ts";
import { moveCard } from "../../core/zones.ts";

// The attack is declared and in progress from now on. It remembers the player the enemy is engaged with, and the attack it was
// declared during (an attack an effect makes inside another one's action window). An attacker's Attack "for its next attack
// this phase" (nextAttackBonus) becomes Attack for this attack.
export function declareStrike(state: ScenarioState, strike: PendingStrike): ScenarioState {
  const enemy = state.cards[strike.enemyId];
  const engaged = enemy?.zone === "engaged" && enemy.controller != null ? { engagedSeat: enemy.controller } : {};
  const outer = state.pendingStrike ? { outer: state.pendingStrike } : {};
  return spendNextAttackBonuses(noteAttackers({ ...state, pendingStrike: { ...strike, ...engaged, ...outer } }, strike), strike.attackerIds);
}

function spendNextAttackBonuses(state: ScenarioState, attackerIds: readonly string[]): ScenarioState {
  const kept = state.modifiers.filter((modifier) => modifier.stat === "nextAttackBonus" && attackerIds.includes(modifier.instanceId));
  if (kept.length === 0) return state;
  const bonuses: Modifier[] = kept.map((modifier) => ({ instanceId: modifier.instanceId, sourceId: modifier.sourceId, stat: "attack", amount: modifier.amount, until: "endOfAttack" }));
  return { ...state, modifiers: [...state.modifiers.filter((modifier) => !kept.includes(modifier)), ...bonuses] };
}

// No action window opens after the declaration (6.8.1): the attack still waits until the Responses to "is declared as an
// attacker" have resolved (rr.response) and the constants that read who is attacking are rebuilt, and settle then goes on
// with its strength and damage (continueStrike). Null when no card in the game asks for that wait: the attack goes straight on.
export function awaitStrike(state: ScenarioState, ctx: ReduceContext): ScenarioState | null {
  const strike = state.pendingStrike;
  if (!strike || !strikeWaits(state, ctx)) return null;
  return { ...state, pendingStrike: { ...strike, awaiting: "strike", awaitDepth: state.stack.length } };
}

// Which attack goes on when a step window has closed: the player attack, when it waits and was opened after the enemy attack
// that also waits (an attack an effect made during that enemy attack's action window).
export function strikeResumes(state: ScenarioState): boolean {
  const strike = state.pendingStrike;
  if (strike?.awaiting == null || state.stack.length > (strike.awaitDepth ?? 0)) return false;
  const attack = state.pendingAttack;
  return attack?.awaiting == null || (strike.awaitDepth ?? 0) >= (attack.awaitDepth ?? 0);
}

// 6.8.4: the attack ends. Its "for this attack" modifiers on its attackers and its enemy expire (rr.lasting-effects); each
// attacker hears `attacked`; effects delayed until the end of the attack resolve, with the enemy as their other card. Then the
// window the attack came from comes back: the combat phase's player attack window, a card's window with the targets still left,
// or none (an effect declared it and goes on), and an attack it was declared during is in progress again.
export function endStrike(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const strike = state.pendingStrike;
  if (!strike) return state;
  const held = new Set([...strike.attackerIds, strike.enemyId]);
  let next: ScenarioState = { ...state, modifiers: state.modifiers.filter((modifier) => !(modifier.until === "endOfAttack" && held.has(modifier.instanceId))) };
  if (heard(next, ctx, "attacked")) {
    for (const attackerId of strike.attackerIds) next = queueEvent(next, { trigger: "attacked", seat: strike.seat, cardId: attackerId, other: strike.enemyId, participants: strike.attackerIds });
  }
  const window: Window | null = strike.back === undefined ? { kind: "playerAttack" } : strike.back;
  next = { ...next, pendingStrike: strike.outer ?? null, window, ...(window ? { activeSeat: strike.seat } : {}) };
  const due = next.delayed.filter((entry) => entry.until === "endOfAttack");
  if (due.length === 0) return next;
  next = { ...next, delayed: next.delayed.filter((entry) => !due.includes(entry)) };
  // The window waits under the delayed effects and comes back when they are done.
  if (window) next = pushFrame({ ...next, window: null }, { frame: "event", cardId: null, seat: strike.seat, peril: false, data: { kind: "resume", window, seat: strike.seat, passed: [] } }, steps);
  for (const entry of [...due].reverse()) {
    next = pushEffectFrame(
      next,
      {
        frame: "delayed",
        sourceId: entry.sourceId,
        actor: entry.seat,
        peril: false,
        effectId: entry.id,
        instructions: entry.instructions,
        cancel: null,
        blockCancel: entry.uncancelable,
        other: strike.enemyId,
        ...(entry.subjectId ? { picked: [entry.subjectId] } : {}),
        ...(entry.cause ? { cause: entry.cause } : {}),
      },
      steps,
    );
  }
  return next;
}

// The window to give back after an attack declared in `window`: a card's window keeps the targets not yet attacked, and closes
// when none is left; the combat phase's window is the default.
export function backAfter(window: Window | null, enemyId: string): Pick<PendingStrike, "back"> {
  if (window?.kind !== "playerAttack" || !window.targets) return {};
  const targets = window.targets.filter((id) => id !== enemyId);
  return { back: targets.length > 0 ? { kind: "playerAttack", targets } : null };
}

// An event whose effect goes on into an attack and its action windows leaves the hand now: it is in its owner's discard pile
// when its effect is done anyway, and a card still in the hand could be played again in those windows.
export function discardPlayedEvent(state: ScenarioState, frameId: string | undefined): ScenarioState {
  const index = state.stack.findIndex((frame) => frame.id === frameId);
  const frame = state.stack[index];
  if (!frame || frame.data.kind !== "effect" || frame.data.finish !== "discardSource" || !frame.cardId) return state;
  const card = state.cards[frame.cardId];
  if (card?.zone !== "hand" || card.controller == null) return state;
  const { finish: _done, ...data } = frame.data;
  const moved = moveCard(state, frame.cardId, { zone: "discard", seat: card.controller });
  return { ...moved, stack: moved.stack.map((entry, at) => (at === index ? { ...entry, data } : entry)) };
}

// What the instructions after DeclareAttack act on: the attacker, as the last picked card.
export function pickAttacker(state: ScenarioState, attackerId: string, frameId: string | undefined): ScenarioState {
  const index = state.stack.findIndex((frame) => frame.id === frameId);
  const frame = state.stack[index];
  if (!frame || frame.data.kind !== "effect") return state;
  const data = { ...frame.data, picked: [...(frame.data.picked ?? []), attackerId] };
  return { ...state, stack: state.stack.map((entry, at) => (at === index ? { ...entry, data } : entry)) };
}

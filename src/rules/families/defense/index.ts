// Rules: rr.step-6-4-1, rr.step-6-4-3, rr.multiple-defenders, rr.cancel, rr.damage, rr.shadow-effects, rr.lasting-effects
// (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { CardRef, Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { askTarget } from "../../windows/choices.ts";
import { strikeEnemy } from "../../combat/combat.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked, seatOf } from "../../interpret/player-verbs.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Frame, Modifier, QueueItem, ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, updateCard } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { shadowCards } from "../../core/zones.ts";
import { redirectDamage } from "./damage.ts";
import { addDefender, addEndReady, assignAttackDamage, cancelAttack, readyUnharmed } from "./defenders.ts";
import { dealShadowTo, discardShadowOf, lookAtShadow, redirectAttack } from "./shadow.ts";
import { shadowAttacks, startShadowAttack } from "./shadow-attack.ts";
import type { Focus } from "../index.ts";

function ref(state: ScenarioState, card: CardRef, focus: Focus): string {
  return refCard(state, card, frameScope(state, focus.seat, focus.sourceId)) ?? "";
}

// PreventAttacks: a cannotAttack modifier that holds against one player only (attackBarred reads its seat).
function preventAttacks(state: ScenarioState, instruction: Extract<Instruction, { verb: "PreventAttacks" }>, focus: Focus): ScenarioState {
  const seat = instruction.who === "picked" ? seatOf(lastPicked(state)) : focus.seat;
  if (seat == null) return state;
  const enemies = instruction.who === "picked" ? [...(state.seats[seat]?.engaged ?? [])] : [ref(state, instruction.target ?? "picked", focus)];
  const added: Modifier[] = enemies
    .filter((id) => state.cards[id] != null)
    .map((id) => ({ instanceId: id, sourceId: focus.sourceId ?? id, stat: "cannotAttack", amount: 1, until: instruction.until, seat }));
  return added.length > 0 ? { ...state, modifiers: [...state.modifiers, ...added] } : state;
}

// StrikeBack: the character is declared as an attacker against the enemy and its attack resolves at once (strikeEnemy). It
// exhausts if it is ready and exhausts to attack. `defense` holds for this attack only.
function strikeBack(state: ScenarioState, instruction: Extract<Instruction, { verb: "StrikeBack" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attackerId = ref(state, instruction.attacker, focus);
  const enemyId = ref(state, instruction.enemy, focus);
  const attacker = state.cards[attackerId];
  const enemy = state.cards[enemyId];
  if (!attacker || !enemy || attacker.controller == null || !inPlay(attacker.zone) || enemy.zone !== "engaged") return state;
  if (!isCharacterType(printedOf(ctx.cards, attacker.code))) return state;
  const exhausted = attacker.exhausted || flagged(state, attackerId, "noExhaustAttack") ? state : updateCard(state, attackerId, { exhausted: true });
  const declared = queueEvent(exhausted, { trigger: "declaredAttacker", seat: attacker.controller, cardId: attackerId, other: enemyId });
  const modifier: Modifier | null = instruction.defense ? { instanceId: enemyId, sourceId: focus.sourceId ?? attackerId, stat: "defense", amount: instruction.defense, until: "endOfPhase" } : null;
  const weakened = modifier ? { ...declared, modifiers: [...declared.modifiers, modifier] } : declared;
  const struck = strikeEnemy(weakened, attacker.controller, enemyId, [attackerId], ctx, steps);
  return modifier ? { ...struck, modifiers: struck.modifiers.filter((entry) => entry !== modifier) } : struck;
}

// ChooseAmount, run from the effect frame with its queue item (effect-frames.ts): the actor picks a number from 1 to the
// smallest amount, offered as choices "1", "2", ...; the number becomes the effect's X.
export function chooseAmount(state: ScenarioState, item: QueueItem, frame: Frame, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  const data = topFrame(state)?.data;
  if (instruction.verb !== "ChooseAmount" || data?.kind !== "effect") return state;
  const setX = (x: number): ScenarioState => patchTop(state, { data: { ...data, x } });
  if (item.chosen) return setX(Number(item.chosen));
  const scope = frameScope(state, item.seat, frame.cardId);
  const most = Math.min(...instruction.upTo.map((amount) => resolveAmount(state, amount, scope, ctx)));
  if (most <= 1) return setX(Math.max(0, most));
  return askTarget(state, item, Array.from({ length: most }, (_, index) => String(index + 1)));
}

// The verbs src/catalog/families/defense.ts adds, for enemy attacks: defenders, the damage window (cancel, prevent, reduce, redirect), shadow cards. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "ChooseAmount":
      // Only an effect frame can ask for the number (chooseAmount); anywhere else X stays as it is.
      return state;
    case "SpendFromPool": {
      const id = ref(state, instruction.from ?? "picked", focus);
      const card = state.cards[id];
      const amount = Math.min(card?.resources ?? 0, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx));
      return card && amount > 0 ? updateCard(state, id, { resources: card.resources - amount }) : state;
    }
    case "RedirectDamage":
      return redirectDamage(state, instruction, focus.seat, focus.sourceId, ctx, steps);
    case "PreventAttacks":
      return preventAttacks(state, instruction, focus);
    case "DiscardShadowOf": {
      const enemyId = ref(state, instruction.target ?? "picked", focus);
      if (instruction.all !== true) return discardShadowOf(state, enemyId);
      let next = state;
      for (let left = shadowCards(state.cards[enemyId]).length; left > 0; left -= 1) next = discardShadowOf(next, enemyId);
      return next;
    }
    case "DealShadowTo":
      return dealShadowTo(state, ref(state, instruction.target, focus), steps, ctx);
    case "LookAtShadow":
      return lookAtShadow(state, ref(state, instruction.target ?? "picked", focus), focus.seat, instruction.markEffect === true, ctx);
    case "ShadowAttacks":
      return shadowAttacks(state, focus.sourceId);
    case "StartShadowAttack":
      return startShadowAttack(state, focus.seat, instruction.attackers, ctx, steps) ?? state;
    case "StrikeBack":
      return strikeBack(state, instruction, focus, ctx, steps);
    case "AddDefender":
      return addDefender(state, lastPicked(state), ctx);
    case "EndDeclaring": {
      const data = topFrame(state)?.data;
      return data?.kind === "effect" ? patchTop(state, { data: { ...data, queue: [] } }) : state;
    }
    case "CancelAttack":
      return cancelAttack(state);
    case "AssignAttackDamage":
      return assignAttackDamage(state, lastPicked(state));
    case "ReadyUnharmed":
      return readyUnharmed(state);
    case "ReadyAfterAttack": {
      const id = instruction.who === "subject" ? ref(state, "subject", focus) : null;
      if (instruction.who === "subject" && !id) return state;
      return addEndReady(state, { id, seat: focus.seat, ...(instruction.ifNoDamage ? { ifNoDamage: true as const } : {}), ...(instruction.pay ? { pay: instruction.pay } : {}) });
    }
    case "RedirectAttack":
      return redirectAttack(state, ref(state, instruction.target ?? "picked", focus), ctx);
    case "ModifyStatVersus": {
      const target = ref(state, instruction.target, focus);
      const versus = ref(state, instruction.versus, focus);
      if (!state.cards[target] || !state.cards[versus] || !focus.sourceId) return state;
      const modifier: Modifier = { instanceId: target, sourceId: focus.sourceId, stat: instruction.stat, amount: instruction.amount, until: instruction.until, against: versus };
      return { ...state, modifiers: [...state.modifiers, modifier] };
    }
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "defense", verbs: ["ChooseAmount", "SpendFromPool", "RedirectDamage", "PreventAttacks", "DiscardShadowOf", "DealShadowTo", "LookAtShadow", "ShadowAttacks", "StartShadowAttack", "StrikeBack", "AddDefender", "EndDeclaring", "CancelAttack", "AssignAttackDamage", "ReadyUnharmed", "ReadyAfterAttack", "RedirectAttack", "ModifyStatVersus"], run };

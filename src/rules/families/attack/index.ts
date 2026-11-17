// Rules: rr.attacks-outside-the-combat-phase, rr.step-6-8b, rr.step-6-8-3, rr.active-location, rr.quest-advancement,
// faq.limitations-on-attacks (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import { announceEnemyAttacked } from "../aflame/attack.ts";
import type { CardRef, Condition, Instruction } from "../../../catalog/boundary.ts";
import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { continueStrike } from "../../combat/combat.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import { placeOnMainQuest } from "../../quest/quest.ts";
import { placeEffectProgress } from "../quest/effect-progress.ts";
import { queueEvent } from "../../windows/queue.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, updateCard } from "../../core/state.ts";
import { playerAttackWindow } from "../../engine/step-window.ts";
import { topFrame } from "../../windows/windows.ts";
import { awaitStrike, declareStrike, discardPlayedEvent, pickAttacker } from "./flow.ts";
import type { Focus } from "../index.ts";

// The verbs src/catalog/families/attack.ts adds, for player attacks: attack modifiers and targets, immediate attacks, attacks into the staging area. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "DeclareAttack":
      return declareAttack(state, instruction, focus, ctx, steps);
    case "OfferAttacks": {
      // A player card's choice of targets: an enemy immune to player card effects is not offered.
      const targets = pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx);
      if (targets.length === 0) return state;
      return { ...discardPlayedEvent(state, topFrame(state)?.id), window: { kind: "playerAttack", targets }, activeSeat: focus.seat, passed: [] };
    }
    case "QuestProgress": {
      const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
      if (amount <= 0) return state;
      const before = steps.length;
      const gate = (current: ScenarioState) => !restricted(current, ctx, "advance").length;
      const placed = instruction.main ? placeOnMainQuest(state, amount, ctx.cards, steps, gate) : placeEffectProgress(state, amount, ctx.cards, steps, gate);
      return afterProgress(placed, before, ctx, steps);
    }
    case "ExcessDamageTo": {
      const strike = state.pendingStrike;
      const enemyId = refCard(state, "picked", frameScope(state, focus.seat, focus.sourceId));
      if (!strike || !enemyId || enemyId === strike.enemyId || !state.cards[enemyId]) return state;
      return { ...state, pendingStrike: { ...strike, excessTo: enemyId } };
    }
    default:
      return null;
  }
}

// Commit with a target: that character is committed to the quest as it is (it may already be exhausted, "commit that hero to
// the quest", 12086:A:2), and "After ~ commits to the quest" hears it.
export function commitCard(state: ScenarioState, target: CardRef, focus: Focus): ScenarioState {
  const id = refCard(state, target, frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.committed || (card.zone !== "heroes" && card.zone !== "play")) return state;
  return queueEvent(updateCard(state, id, { committed: true }), { trigger: "committed", seat: card.controller, cardId: id });
}

// A character is declared as an attacker against an enemy by an effect, and its attack resolves now with the steps of a player
// attack (rr.attacks-outside-the-combat-phase): the Responses to the declaration, the action windows, strength and damage, and
// the end of the attack. It is an extra attack (faq.limitations-on-attacks), declared by the attacker's controller. A declared
// attacker exhausts (rr.step-6-8b): it must be ready, unless the effect's cost already exhausted it.
export function declareAttack(state: ScenarioState, instruction: Extract<Instruction, { verb: "DeclareAttack" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const picked = scope.picked ?? [];
  const attackerId = instruction.attacker ? refCard(state, instruction.attacker, scope) : (picked.at(-2) ?? null);
  const enemyId = instruction.enemy ? refCard(state, instruction.enemy, scope) : (picked.at(-1) ?? null);
  const attacker = attackerId ? state.cards[attackerId] : undefined;
  const enemy = enemyId ? state.cards[enemyId] : undefined;
  if (!attackerId || !enemyId || !attacker || !enemy || attacker.controller == null) return state;
  if ((attacker.zone !== "heroes" && attacker.zone !== "play") || !isCharacterType(printedOf(ctx.cards, attacker.code))) return state;
  if ((enemy.zone !== "engaged" && enemy.zone !== "staging") || printedOf(ctx.cards, enemy.code).type !== "enemy") return state;
  if (flagged(state, attackerId, "cannotAttack") || (!instruction.exhausted && attacker.exhausted)) return state;
  const seat = attacker.controller;
  const exhausts = !instruction.exhausted && !flagged(state, attackerId, "noExhaustAttack");
  const frameId = topFrame(state)?.id;
  let next = exhausts ? updateCard(state, attackerId, { exhausted: true }) : state;
  next = queueEvent(next, { trigger: "declaredAttacker", seat, cardId: attackerId, other: enemyId });
  return openStrike(next, seat, enemyId, [attackerId], frameId, ctx, steps, instruction.ranged);
}

// An attack an effect declares, its attackers already exhausted and announced: the strike is declared, the last attacker is
// the effect's last picked card, and the attack resolves through the attack flow (also the attachments family's ChooseAttackers).
export function openStrike(state: ScenarioState, seat: number, enemyId: string, attackerIds: string[], frameId: string | undefined, ctx: ReduceContext, steps: EngineStep[], ranged?: boolean): ScenarioState {
  let next = announceEnemyAttacked(declareStrike({ ...state, window: null }, { seat, enemyId, attackerIds, back: null, ...(ranged ? { ranged: true } : {}) }), seat, enemyId, attackerIds, ctx);
  next = discardPlayedEvent(pickAttacker(next, attackerIds.at(-1) ?? "", frameId), frameId);
  // 6.8.1: an action window comes before its strength; the Responses to the declaration resolve first either way.
  return playerAttackWindow(next, ctx, "strike") ?? awaitStrike(next, ctx) ?? continueStrike(next, ctx, steps);
}

// "Declared as the only attacker" (143015:A:3): the attack in progress was declared with exactly one attacker (rr.step-6-8b: the attackers of an attack are declared together).
function condition(state: ScenarioState, found: Condition): boolean | null {
  return found.kind === "soleAttacker" ? state.pendingStrike?.attackerIds.length === 1 : null;
}

export const manifest: RulesFamily = { name: "attack", verbs: ["DeclareAttack", "OfferAttacks", "QuestProgress", "ExcessDamageTo"], run, condition: (state, found) => condition(state, found) };

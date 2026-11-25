// Rules: rr.step-6-8-1, rr.attacks-outside-the-combat-phase, faq.limitations-on-attacks, rr.the-word-choose, rr.encounter-deck
// (data/rules/entries.json).
//
// The attachments family's verbs that ask a player step by step: healing damage split among characters, an attack an
// effect declares against one enemy (Ambush), and a look at the top X cards of the encounter deck (Interrogation).
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { askTarget } from "../../windows/choices.ts";
import { canAttack, characters } from "../../combat/combat.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { destroyCard } from "../../core/keywords.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { queueEvent } from "../../windows/queue.ts";
import { exhaustAnnounced } from "../../windows/exhaust.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { openStrike } from "../attack/index.ts";
import { healBlocked } from "../burden/life.ts";
import { healAllowed, healDamage } from "../dreamchaser/heal-cap.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { playerSource } from "../quest/threat.ts";

// The option that ends a choice made one card at a time.
export const DONE = "done";

function again(state: ScenarioState, instruction: Instruction, seat: number): ScenarioState {
  const data = effectData(state);
  return data ? patchTop(state, { data: { ...data, queue: [{ instruction, seat, chosen: null }, ...data.queue] } }) : state;
}

// HealAmong: one damage at a time on a damaged card that matches, chosen by the actor, until `amount` is healed or they stop (`exact`: they cannot stop while a card can still be healed).
export function healAmong(state: ScenarioState, instruction: Extract<Instruction, { verb: "HealAmong" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const total = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const healed = instruction.healed ?? 0;
  if (healed >= total || focus.chosen === DONE) return state;
  const capped = instruction.capped ?? [];
  const options = pickCandidates(state, { ...instruction.pick, damaged: true }, focus.seat, [], focus.sourceId, ctx).filter((id) => !capped.includes(id) && !healBlocked(state, id) && healAllowed(state, id, 1, ctx) > 0);
  if (options.length === 0) return state;
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : undefined;
  if (!chosen) return effectData(state) ? askTarget(state, { instruction, seat: focus.seat, chosen: null }, instruction.exact ? options : [...options, DONE]) : state;
  const card = state.cards[chosen];
  if (!card) return state;
  const healedBy = healDamage(state, chosen, 1, ctx, { sourceId: focus.sourceId });
  const healedOne = queueEvent(healedBy.state, { trigger: "healed", seat: card.controller, cardId: chosen, ...(focus.sourceId ? { other: focus.sourceId } : {}), ...(playerSource(state, focus.sourceId, ctx) ? { byPlayerCard: true } : {}) });
  // An attachment that cut the heal to 1 (Noxious Supplies) is discarded after it, and this effect heals that card no more: "the amount of damage healed is reduced to 1" holds for the whole effect.
  const reduced = healedBy.reducer ? destroyCard(healedOne, healedBy.reducer, ctx.cards, steps) : healedOne;
  return again(reduced, { ...instruction, healed: healed + 1, ...(healedBy.reducer ? { capped: [...capped, chosen] } : {}) }, focus.seat);
}

// ChooseAttackers: the enemy is read (and the source discarded, when that is the cost), then the actor chooses attackers one at
// a time among their characters that may attack it, and the attack resolves: each attacker exhausts and is declared, and the
// attack's strength is dealt against the enemy's defense (rr.step-6-8-1).
export function declareAttack(state: ScenarioState, instruction: Extract<Instruction, { verb: "ChooseAttackers" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (instruction.enemy == null) {
    const enemyId = refCard(state, instruction.target, frameScope(state, focus.seat, focus.sourceId));
    const paid = instruction.discardSource && focus.sourceId ? destroyCard(state, focus.sourceId, ctx.cards, steps) : state;
    return enemyId ? declareAttack(paid, { ...instruction, discardSource: false, enemy: enemyId }, { seat: focus.seat, sourceId: focus.sourceId }, ctx, steps) : paid;
  }
  const enemyId = instruction.enemy;
  const enemy = state.cards[enemyId];
  if (!enemy || !inPlay(enemy.zone)) return state;
  const chosen = instruction.attackers ?? [];
  const options = characters(state, focus.seat, ctx.cards).filter((id) => !chosen.includes(id) && canAttack(state, focus.seat, id, enemyId, ctx.cards));
  const picked = focus.chosen && options.includes(focus.chosen) ? focus.chosen : chosen.length === 0 && options.length === 1 ? options[0] : undefined;
  if (picked) return declareAttack(state, { ...instruction, attackers: [...chosen, picked] }, { seat: focus.seat, sourceId: focus.sourceId }, ctx, steps);
  if (focus.chosen !== DONE && options.length > 0) {
    if (!effectData(state)) return state;
    return askTarget(state, { instruction, seat: focus.seat, chosen: null }, chosen.length > 0 ? [...options, DONE] : options);
  }
  if (chosen.length === 0) return state;
  let next = state;
  for (const id of chosen) {
    if (!flagged(next, id, "noExhaustAttack")) next = exhaustAnnounced(next, id, ctx);
    next = queueEvent(next, { trigger: "declaredAttacker", seat: focus.seat, cardId: id, other: enemyId });
  }
  return openStrike(next, focus.seat, enemyId, chosen, topFrame(next)?.id, ctx, steps);
}

// Rules: rr.step-6-8-1, rr.attacks-outside-the-combat-phase, faq.limitations-on-attacks, rr.the-word-choose, rr.encounter-deck
// (data/rules/entries.json).
//
// The attachments family's verbs that ask a player step by step: healing damage split among characters, an attack an
// effect declares against one enemy (Ambush), and a look at the top X cards of the encounter deck (Interrogation).
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../amounts.ts";
import { askTarget } from "../choices.ts";
import { canAttack, characters } from "../combat.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { destroyCard } from "../keywords.ts";
import { pickCandidates } from "../pick.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, inPlay, updateCard } from "../state.ts";
import { patchTop, topFrame } from "../windows.ts";
import { openStrike } from "./attack.ts";
import { healBlocked } from "./burden-life.ts";
import { effectData } from "./encounter-moves.ts";
import type { Focus } from "./index.ts";

// The option that ends a choice made one card at a time.
export const DONE = "done";

function again(state: ScenarioState, instruction: Instruction, seat: number): ScenarioState {
  const data = effectData(state);
  return data ? patchTop(state, { data: { ...data, queue: [{ instruction, seat, chosen: null }, ...data.queue] } }) : state;
}

// HealAmong: one damage at a time on a damaged card that matches, chosen by the actor, until `amount` is healed or they stop.
export function healAmong(state: ScenarioState, instruction: Extract<Instruction, { verb: "HealAmong" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const total = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const healed = instruction.healed ?? 0;
  if (healed >= total || focus.chosen === DONE) return state;
  const options = pickCandidates(state, { ...instruction.pick, damaged: true }, focus.seat, [], focus.sourceId, ctx).filter((id) => !healBlocked(state, id));
  if (options.length === 0) return state;
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : undefined;
  if (!chosen) return effectData(state) ? askTarget(state, { instruction, seat: focus.seat, chosen: null }, [...options, DONE]) : state;
  const card = state.cards[chosen];
  if (!card) return state;
  const healedOne = queueEvent(updateCard(state, chosen, { damage: card.damage - 1 }), { trigger: "healed", seat: card.controller, cardId: chosen });
  return again(healedOne, { ...instruction, healed: healed + 1 }, focus.seat);
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
    if (!flagged(next, id, "noExhaustAttack")) next = updateCard(next, id, { exhausted: true });
    next = queueEvent(next, { trigger: "declaredAttacker", seat: focus.seat, cardId: id, other: enemyId });
  }
  return openStrike(next, focus.seat, enemyId, chosen, topFrame(next)?.id, ctx, steps);
}

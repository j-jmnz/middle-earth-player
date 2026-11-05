// Rules: rr.attacks-outside-the-combat-phase, faq.additional-attacks, rr.in-player-order (data/rules/entries.json); ledger lines 11216:A:4 and 11216:B:4. "Captain Sahír makes an attack against each other player (in turn order)":
// AttackOtherPlayers queues one immediate attack of the source enemy for each player it is not engaged with, in turn order from the first player; each runs when the one before it is resolved, dealt a shadow card of its
// own, as the attacks ImmediateAttackEach queues do (families/burden/attack.ts). The enemy stays engaged with its own player.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import { beginEnemyAttack } from "../../combat/combat.ts";
import { attackBarred } from "../../interpret/constants.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { QueueItem, ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { patchTop } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { dealAttackShadow } from "../defense/listen.ts";
import { effectData } from "../encounter/moves.ts";

type Verb = Extract<Instruction, { verb: "AttackOtherPlayers" }>;

// One attack of the enemy against the seat, as an attack outside the combat phase.
function attackSeat(state: ScenarioState, enemyId: string, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemy = state.cards[enemyId];
  if (!enemy || (enemy.zone !== "engaged" && enemy.zone !== "staging") || state.seats[seat]?.eliminated || attackBarred(state, enemyId, seat)) return state;
  const begun = beginEnemyAttack(dealAttackShadow(state, enemyId, ctx, steps), seat, enemyId, ctx, steps, enemy.zone === "staging");
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } } : begun;
}

export function attackOtherPlayers(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = instruction.target ? refCard(state, instruction.target, frameScope(state, focus.seat, focus.sourceId)) : focus.sourceId;
  const enemy = id ? state.cards[id] : undefined;
  if (!id || !enemy) return state;
  if (instruction.seat != null) return attackSeat(state, id, instruction.seat, ctx, steps);
  const data = effectData(state);
  if (!data) return state;
  const queued = livingSeats(state)
    .filter((seat) => seat !== enemy.controller)
    .map((seat): QueueItem => ({ instruction: { ...instruction, seat }, seat: focus.seat, chosen: null }));
  return patchTop(state, { data: { ...data, queue: [...queued, ...data.queue] } });
}

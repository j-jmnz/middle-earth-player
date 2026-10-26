// Rules: rr.attacks-outside-the-combat-phase, faq.additional-attacks, rr.step-6-4-3, rr.destroy (data/rules/entries.json).
//
// Attacks an encounter card makes outside the combat phase, and what an attack destroyed. `ImmediateAttackEach` ("Each engaged
// enemy makes an immediate attack", 141065:A:1) queues one attack for every engaged enemy; each is an immediate attack as the
// enemy's own card makes it (effect-frames.ts), against the player the enemy is engaged with.
import type { Instruction } from "../../catalog/boundary.ts";

import { beginEnemyAttack } from "../combat.ts";
import { attackBarred } from "../constants.ts";
import type { EngineStep } from "../intents.ts";
import { dealOneShadow, type ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import { discardShadowOf } from "../shadow.ts";
import type { PendingAttack, QueueItem, ScenarioState } from "../state.ts";
import { livingSeats } from "../state.ts";
import { patchTop } from "../windows.ts";
import type { Focus } from "./index.ts";
import { declaredDefenders } from "./defense-defenders.ts";
import { effectData } from "./encounter-moves.ts";

type Each = Extract<Instruction, { verb: "ImmediateAttackEach" }>;

// The enemies engaged with a player now, in player order and the order they engaged in.
function engagedEnemies(state: ScenarioState): string[] {
  return livingSeats(state).flatMap((seat) => state.seats[seat]?.engaged ?? []);
}

// One immediate attack by an enemy that is still engaged and may attack. The attack is counted before it starts (the Forced effects
// of its start push frames over the running effect's), and it is dealt a shadow card of its own; one dealt for an earlier attack is
// discarded first (rr.attacks-outside-the-combat-phase, faq.additional-attacks).
function attackWith(state: ScenarioState, enemyId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemy = state.cards[enemyId];
  if (enemy?.zone !== "engaged" || enemy.controller == null || attackBarred(state, enemyId, enemy.controller)) return state;
  const data = effectData(state);
  const counted = data ? patchTop(state, { data: { ...data, returned: data.returned + 1 } }) : state;
  const dealt = dealOneShadow(discardShadowOf(counted, enemyId), enemyId);
  const begun = beginEnemyAttack(dealt, enemy.controller, enemyId, ctx, steps);
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } } : begun;
}

// ImmediateAttackEach. The first time it runs it queues an attack for each engaged enemy ahead of the rest of the effect; each
// queued attack runs when the one before it is resolved. Outside an effect nobody can wait for the attacks, so none is made.
export function immediateAttackEach(state: ScenarioState, instruction: Each, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (instruction.enemy != null) return attackWith(state, instruction.enemy, ctx, steps);
  const data = effectData(state);
  if (!data) return state;
  const queued = engagedEnemies(state).map((enemy): QueueItem => ({ instruction: { ...instruction, enemy }, seat: focus.seat, chosen: null }));
  return patchTop(state, { data: { ...data, queue: [...queued, ...data.queue] } });
}

// The characters an attack destroyed, once it is over: its defenders and the hero an undefended attack landed on that are in the
// discard pile with as much damage as they have hit points ("If this attack destroys a character", 141065:A:2, 141066:A:2).
export function charactersDestroyed(state: ScenarioState, attack: PendingAttack, ctx: ReduceContext): number {
  const hit = new Set([...declaredDefenders(attack), ...(attack.heroId ? [attack.heroId] : [])]);
  return [...hit].filter((id) => {
    const card = state.cards[id];
    if (!card || card.zone !== "discard") return false;
    const health = printedOf(ctx.cards, card.code).health;
    return health != null && card.damage >= health;
  }).length;
}

// Rules: rr.attacks-outside-the-combat-phase, faq.additional-attacks, rr.step-6-4-3, rr.destroy (data/rules/entries.json).
//
// Attacks an encounter card makes outside the combat phase, and what an attack destroyed. `ImmediateAttackEach` ("Each engaged
// enemy makes an immediate attack", 141065:A:1) queues one attack for every engaged enemy; each is an immediate attack as the
// enemy's own card makes it (effect-frames.ts), against the player the enemy is engaged with.
import type { Instruction } from "../../../catalog/boundary.ts";

import { hasTrait } from "../../interpret/conditions.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { PendingAttack, QueueItem, ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { isolatedAreas, sharing } from "../breaking/areas.ts";
import { queueEvent } from "../../windows/queue.ts";
import { patchTop } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { declaredDefenders } from "../defense/defenders.ts";
import { damageGoesTo } from "../defense/damage.ts";
import { gameReads } from "../../core/game-reads.ts";
import { attackWith } from "../attack/immediate.ts";
import { effectData } from "../encounter/moves.ts";

type Each = Extract<Instruction, { verb: "ImmediateAttackEach" }>;

// The enemies engaged with a player now, in player order and the order they engaged in; while the areas are isolated, only those engaged with the players sharing the acting seat's area ("each Wight enemy engaged with a player", 148014:A:1: at the revealer's stage).
function engagedEnemies(state: ScenarioState, seat: number): string[] {
  return (isolatedAreas(state) ? sharing(state, seat) : livingSeats(state)).flatMap((index) => state.seats[index]?.engaged ?? []);
}

// ImmediateAttackEach. The first time it runs it queues an attack for each engaged enemy ahead of the rest of the effect; each
// queued attack runs when the one before it is resolved. Outside an effect nobody can wait for the attacks, so none is made.
export function immediateAttackEach(state: ScenarioState, instruction: Each, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (instruction.enemy != null) return attackWith(state, instruction.enemy, ctx, steps);
  const data = effectData(state);
  if (!data) return state;
  // `trait`: only the engaged enemies with it ("All engaged Troll enemies attack", 900208:A:1).
  const trait = instruction.trait;
  const queued = (instruction.own ? (state.seats[focus.seat]?.engaged ?? []) : engagedEnemies(state, focus.seat))
    .filter((enemy) => (trait == null || hasTrait(state, enemy, trait, ctx)) && (instruction.notTrait == null || !hasTrait(state, enemy, instruction.notTrait, ctx)))
    .map((enemy): QueueItem => ({ instruction: { ...instruction, enemy }, seat: focus.seat, chosen: null }));
  return patchTop(state, { data: { ...data, queue: [...queued, ...data.queue] } });
}

// The characters an attack destroyed, once it is over: its defenders and the hero an undefended attack landed on (or the character their
// damage was redirected to) that are in the discard pile with as much damage as they have hit points ("If this attack destroys a
// character", 141065:A:2, 141066:A:2; "After a character is destroyed by a Hill Troll", 01130:A:4).
export function destroyedByAttack(state: ScenarioState, attack: PendingAttack, ctx: ReduceContext): string[] {
  const hit = new Set([...declaredDefenders(attack), ...(attack.heroId ? [attack.heroId] : [])].flatMap((id) => [id, damageGoesTo(state, id)]));
  return [...hit].filter((id) => {
    const card = state.cards[id];
    if (!card || card.zone !== "discard") return false;
    const health = printedOf(ctx.cards, card.code).health;
    return health != null && card.damage >= health;
  });
}

export function charactersDestroyed(state: ScenarioState, attack: PendingAttack, ctx: ReduceContext): number {
  return destroyedByAttack(state, attack, ctx).length;
}

// Queues `characterDestroyedByAttack` for each character the attack destroyed, when some card in the game hears it (so no other game
// queues the event). Called as the attack ends, where the damage has been answered and a held lethal wound has become a destruction.
export function announceDestroyed(state: ScenarioState, attack: PendingAttack, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"characterDestroyedByAttack"')) return state;
  return destroyedByAttack(state, attack, ctx).reduce((next, id) => {
    // The damage beyond its hit points that is still on the character: damage a Response canceled after it was dealt is not excess (18049:A:2).
    const hitPoints = attack.defense?.hitPointsOn?.[id];
    const excess = hitPoints != null ? Math.max(0, (state.cards[id]?.damage ?? 0) - hitPoints) : 0;
    return queueEvent(next, { trigger: "characterDestroyedByAttack", seat: state.cards[id]?.controller ?? attack.seat, subject: id, other: attack.enemyId, ...(excess > 0 ? { amount: excess } : {}) });
  }, state);
}

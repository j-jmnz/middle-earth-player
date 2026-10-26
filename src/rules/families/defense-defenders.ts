// Rules: rr.multiple-defenders, rr.step-6-4-1, rr.step-6-4-3, rr.step-6-4-4, rr.defending-player, rr.cancel
// (data/rules/entries.json). Several defenders against one attack, defenders declared by an effect, the damage of a defended
// attack, a canceled attack, and what the end of an attack announces about its defenders.
import type { Instruction, PickSpec, SimpleInstruction } from "../../catalog/boundary.ts";

import { canDefend } from "../combat.ts";
import { pushEffectFrame } from "../effect-frames.ts";
import { ruleCause } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { defenseAsDefender, modifiedStat, placeDamage } from "../keywords.ts";
import { pickCandidates } from "../pick.ts";
import { readyCard } from "../player-verbs.ts";
import { isCharacterType, printedOf, type PrintedCard, type Sphere } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { GameEvent, PendingAttack, ScenarioState } from "../state.ts";
import { flagged, inPlay, livingSeats, updateCard } from "../state.ts";
import { groupResources } from "./defense-conditions.ts";
import { noteAttackDamage } from "./defense-damage.ts";
import { listened, queueHeard } from "./defense-listen.ts";
import type { AttackDefense, EndReady } from "./defense-types.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// The triggers that read which defenders took damage: their marks are kept while some card listens to one of them.
const MARKED = ["declaredDefender", "enemyAttacks", "defended", "defendedUnharmed", "defenderDestroyed"] as const;

export function withDefense(attack: PendingAttack, patch: Partial<AttackDefense>): PendingAttack {
  return { ...attack, defense: { ...attack.defense, ...patch } };
}

function patchAttack(state: ScenarioState, patch: Partial<AttackDefense>): ScenarioState {
  return state.pendingAttack ? { ...state, pendingAttack: withDefense(state.pendingAttack, patch) } : state;
}

// The characters declared as defenders of the attack: the first one and the extra ones, whether still in play or not.
export function declaredDefenders(attack: PendingAttack | null): string[] {
  if (!attack) return [];
  return [...(attack.defenderId ? [attack.defenderId] : []), ...(attack.defense?.extra ?? [])];
}

// The character is defending the attack in progress (a declared defender, and the attack is not considered undefended).
export function isDefending(state: ScenarioState, id: string): boolean {
  const attack = state.pendingAttack;
  return attack != null && !attack.undefended && declaredDefenders(attack).includes(id);
}

// The character could be declared as one more defender of the attack in progress (pick `canDefend`).
export function canDeclareDefender(state: ScenarioState, id: string, cards: Cards): boolean {
  const attack = state.pendingAttack;
  return attack != null && !declaredDefenders(attack).includes(id) && canDefend(state, attack.seat, id, cards);
}

// Remembers a defender's damage as it is declared, so the end of the attack can tell whether it took damage from it.
export function markDefender(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const card = state.cards[id];
  if (!attack || !card || !listened(state, ctx, MARKED)) return state;
  return { ...state, pendingAttack: withDefense(attack, { marks: { ...attack.defense?.marks, [id]: card.damage } }) };
}

// AddDefender: the card joins the defenders of the attack in progress. It exhausts unless it is exhausted already or does not
// exhaust to defend, and its declaration is announced.
export function addDefender(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const card = state.cards[id];
  if (!attack || !card || !inPlay(card.zone) || !isCharacterType(printedOf(ctx.cards, card.code)) || declaredDefenders(attack).includes(id)) return state;
  const exhausted = card.exhausted || flagged(state, id, "noExhaustDefend") ? state : updateCard(state, id, { exhausted: true });
  const current = exhausted.pendingAttack ?? attack;
  const joined: PendingAttack = current.defenderId ? withDefense(current, { extra: [...(current.defense?.extra ?? []), id] }) : { ...current, defenderId: id };
  const declared = queueEvent({ ...exhausted, pendingAttack: joined }, { trigger: "declaredDefender", seat: attack.seat, cardId: id, other: attack.enemyId });
  return markDefender(declared, id, ctx);
}

// A defender was declared by an effect before the defense step (Anchor Watch, Hold the Line): no other is declared then.
export function defendersDeclared(state: ScenarioState): boolean {
  return state.pendingAttack?.defenderId != null;
}

function declareMore(pick: PickSpec, times: number): Instruction[] {
  return Array.from({ length: times }, (): Instruction => ({
    verb: "Choose",
    who: "actor",
    options: [
      { id: "another", requires: { kind: "canPick", pick }, instructions: [{ verb: "Pick", pick }, { verb: "AddDefender" }] },
      { id: "done", instructions: [{ verb: "EndDeclaring" }] },
    ],
  }));
}

// After the defending player declared a defender, a seat that may declare any number of defenders this phase (Stand Together,
// 01038) declares the others in a frame; the attack goes on to the window after the declaration when it is done.
export function moreDefenders(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  const attack = state.pendingAttack;
  if (!attack || !flagged(state, `seat:${attack.seat}`, "declaresManyDefenders")) return null;
  const pick: PickSpec = { type: "character", control: "you", canDefend: true };
  const count = pickCandidates(state, pick, attack.seat, [], null, ctx).length;
  if (count === 0) return null;
  const waiting: ScenarioState = { ...state, pendingAttack: { ...attack, awaiting: "defenders", awaitDepth: state.stack.length } };
  return pushEffectFrame(waiting, { frame: "ResolveEffect", sourceId: null, actor: attack.seat, peril: false, effectId: "defense:defenders", instructions: declareMore(pick, count), cancel: null, blockCancel: null }, steps);
}

// The damage of a defended attack when the family decides it: several defenders pool their Defense and the defending player
// assigns all the damage to one of them (rr.multiple-defenders), or the attack is resolved against another enemy (06062).
// Null when the attack resolves as usual. `wait`: the defending player is choosing the defender that takes the damage.
export function specialStrike(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): { state: ScenarioState; wait: boolean } | null {
  const attack = state.pendingAttack;
  const enemy = attack ? state.cards[attack.enemyId] : undefined;
  if (!attack || !enemy) return null;
  const strength = modifiedStat(state, enemy, "attack", ctx.cards);
  const redirect = attack.defense?.redirectTo ? state.cards[attack.defense.redirectTo] : undefined;
  if (redirect && inPlay(redirect.zone)) {
    const defense = modifiedStat(state, redirect, "defense", ctx.cards);
    steps.push({ kind: "strike", side: "enemy", enemyId: attack.enemyId, targetId: redirect.id, attack: strength, defense, undefended: false, cause: ruleCause("rr.step-6-4-3") });
    return { state: placeDamage(state, redirect.id, Math.max(0, strength - defense), ctx.cards, steps, "combat", ruleCause("rr.step-6-4-3")), wait: false };
  }
  if (!attack.defense?.extra?.length) return null;
  const standing = declaredDefenders(attack).filter((id) => inPlay(state.cards[id]?.zone ?? "removed"));
  // Considered undefended by a shadow effect, or no defender left: the attack is undefended as usual.
  if (standing.length === 0 || (attack.undefended && attack.defenderId != null && standing.includes(attack.defenderId))) return null;
  const chosen = attack.defense.damageTo && standing.includes(attack.defense.damageTo) ? attack.defense.damageTo : standing.length === 1 ? standing[0] : undefined;
  if (!chosen) {
    const waiting: ScenarioState = { ...state, pendingAttack: { ...attack, undefended: false, awaiting: "damage", awaitDepth: state.stack.length } };
    const pick: PickSpec = { type: "character", control: "any", defending: true };
    return { state: pushEffectFrame(waiting, { frame: "ResolveEffect", sourceId: null, actor: attack.seat, peril: false, effectId: "defense:damage", instructions: [{ verb: "Pick", pick }, { verb: "AssignAttackDamage" }], cancel: null, blockCancel: null }, steps), wait: true };
  }
  const pooled: ScenarioState = { ...state, pendingAttack: { ...attack, undefended: false } };
  const defense = standing.reduce((total, id) => total + defenseAsDefender(pooled, id, ctx.cards), 0);
  steps.push({ kind: "strike", side: "enemy", enemyId: attack.enemyId, targetId: chosen, attack: strength, defense, undefended: false, cause: ruleCause("rr.step-6-4-3") });
  const damaged = placeDamage(pooled, chosen, Math.max(0, strength - defense), ctx.cards, steps, "combat", ruleCause("rr.step-6-4-3"));
  return { state: noteAttackDamage(pooled, damaged, ctx), wait: false };
}

// The defender took no damage from the attack: its damage is no higher than when it was declared.
function unharmed(state: ScenarioState, attack: PendingAttack, id: string): boolean {
  const card = state.cards[id];
  const mark = attack.defense?.marks?.[id];
  return card != null && inPlay(card.zone) && (mark == null || card.damage <= mark);
}

function unharmedDefenders(state: ScenarioState, attack: PendingAttack): string[] {
  return attack.undefended ? [] : declaredDefenders(attack).filter((id) => unharmed(state, attack, id));
}

// The attack dealt no damage: every defender is in play with no more damage than it was declared with, and no hero took it.
function dealtNoDamage(state: ScenarioState, attack: PendingAttack): boolean {
  const defenders = declaredDefenders(attack);
  return attack.heroId == null && !attack.undefended && defenders.length > 0 && defenders.every((id) => unharmed(state, attack, id));
}

// ReadyAfterAttack: the ready waits on the attack in progress until its end.
export function addEndReady(state: ScenarioState, ready: EndReady): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack) return state;
  return patchAttack(state, { readies: [...(attack.defense?.readies ?? []), ready] });
}

// ReadyUnharmed (engine use): each defender that took no damage from the attack readies.
export function readyUnharmed(state: ScenarioState): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack) return state;
  return unharmedDefenders(state, attack).reduce((next, id) => readyCard(next, id), state);
}

// "The players as a group may spend 2 Tactics resources to ready each defending character that takes no damage": a choice,
// paid one resource at a time from any player's hero that can pay for the sphere.
function payToReady(amount: number, sphere: Sphere): Instruction[] {
  const pick: PickSpec = { type: "hero", control: "any", hasResources: true, printedIcon: sphere };
  const pay = Array.from({ length: amount }, (): SimpleInstruction[] => [{ verb: "Pick", pick }, { verb: "SpendFromPool", amount: 1 }]).flat();
  return [{ verb: "Choose", who: "actor", options: [{ id: "ready", instructions: [...pay, { verb: "ReadyUnharmed" }] }, { id: "decline", instructions: [] }] }];
}

// The readies waiting on the attack run at its end: one without a payment at once, one with a payment as a choice.
function runReadies(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  const attack = state.pendingAttack;
  const readies = attack?.defense?.readies ?? [];
  if (!attack || readies.length === 0) return null;
  let next = patchAttack(state, { readies: [] });
  for (const ready of readies) {
    if (ready.ifNoDamage && !dealtNoDamage(next, attack)) continue;
    if (!ready.pay) {
      const ids = ready.id ? [ready.id] : unharmedDefenders(next, attack);
      next = ids.filter((id) => inPlay(next.cards[id]?.zone ?? "removed")).reduce((current, id) => readyCard(current, id), next);
      continue;
    }
    const sphere = ready.pay.sphere as Sphere;
    if (unharmedDefenders(next, attack).length === 0 || groupResources(next, livingSeats(next), sphere, ctx) < ready.pay.amount) continue;
    const current = next.pendingAttack;
    if (!current) break;
    const waiting: ScenarioState = { ...next, pendingAttack: { ...current, awaiting: "end", awaitDepth: next.stack.length } };
    next = pushEffectFrame(waiting, { frame: "ResolveEffect", sourceId: null, actor: ready.seat, peril: false, effectId: "defense:ready", instructions: payToReady(ready.pay.amount, sphere), cancel: null, blockCancel: null }, steps);
  }
  return next;
}

// What the end of an attack (6.4.4) says about its defenders, once the damage just dealt has been answered: "After ~ defends"
// for each defender in play, "and takes no damage" for one that took none, and "is destroyed while defending" for one that was.
function defenderEvents(state: ScenarioState, attack: PendingAttack): GameEvent[] {
  const events: GameEvent[] = [];
  for (const id of declaredDefenders(attack)) {
    const card = state.cards[id];
    if (!card) continue;
    const about = { seat: attack.seat, cardId: id, subject: id, other: attack.enemyId };
    if (inPlay(card.zone)) {
      if (attack.undefended) continue;
      events.push({ trigger: "defended", ...about });
      if (unharmed(state, attack, id)) events.push({ trigger: "defendedUnharmed", ...about });
    } else if (card.zone === "discard") {
      events.push({ trigger: "defenderDestroyed", ...about });
    }
  }
  return events;
}

// Called as the attack ends (finishAttack): the attack waits first for the Responses to damage it just dealt (a canceled
// damage is not taken), then for the readies and Responses its end starts, with the attack still in progress so they can
// name the attacking enemy. Null when the attack may end now.
export function holdAttackEnd(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  const attack = state.pendingAttack;
  if (!attack) return null;
  const hold = (next: ScenarioState): ScenarioState => (next.pendingAttack ? { ...next, pendingAttack: { ...next.pendingAttack, awaiting: "end", awaitDepth: next.stack.length } } : next);
  if ((state.pendingEvents ?? []).some((event) => event.trigger === "damageDealt") && listened(state, ctx, ["damageDealt"])) return hold(state);
  // A canceled attack was not defended.
  if (attack.defense?.canceled) return null;
  const readied = runReadies(state, ctx, steps);
  if (readied) return readied.stack.length > state.stack.length ? readied : hold(readied);
  if (attack.defense?.announced) return null;
  const events = defenderEvents(state, attack).filter((event) => listened(state, ctx, [event.trigger]));
  if (events.length === 0) return null;
  const announced = events.reduce((next, event) => queueHeard(next, ctx, event), patchAttack(state, { announced: true }));
  return hold(announced);
}

// CancelAttack, and an attack canceled earlier: it ends now (rr.cancel), with nothing left of it to resolve.
export function cancelAttack(state: ScenarioState): ScenarioState {
  return patchAttack(state, { canceled: true });
}

export function attackCanceled(state: ScenarioState): boolean {
  return state.pendingAttack?.defense?.canceled === true;
}

// AssignAttackDamage (engine use): the last picked defender takes the attack's damage.
export function assignAttackDamage(state: ScenarioState, id: string): ScenarioState {
  return id && isDefending(state, id) ? patchAttack(state, { damageTo: id }) : state;
}

// Rules: rr.damage, rr.cancel, rr.step-6-4-3, rr.step-3-4, rr.active-location, rr.modifiers (data/rules/entries.json).
// The damage window of the defense family: what follows a cancel, damage moved to another card, damage assigned to another
// hero, characters an undefended attack may land on, and quest progress assigned as damage.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { characters } from "../../combat/combat.ts";
import { currentCause, effectCause, UNATTRIBUTED, type Cause } from "../../core/cause.ts";
import { effectsOf } from "../../windows/listen.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { familyAttackDamaged } from "../../interpret/family-hooks.ts";
import { modifiedStat, placeDamage, type DamageSource } from "../../core/keywords.ts";
import { isCharacterType, printedOf, type PrintedCard } from "../../core/printed.ts";
import { placeQuestProgress, questPointsOf } from "../../quest/quest.ts";
import type { CardInstance, GameEvent, PendingAttack, ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, modifierActive, updateCard } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { queueEvent } from "../../windows/queue.ts";
import { defendingAgainst } from "../angmar/combat.ts";
import { scrollDamageTarget } from "../pelargir/scroll.ts";
import { bodyguardTarget } from "../pelargir/vale/bodyguard.ts";
import { listened, queueHeard, trimFollowUps } from "./listen.ts";
import { bilboDamageBarred } from "../riddles/gollum.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// After damage just dealt to a card was canceled (CancelDamage, RedirectDamage): its queued "took damage" events lose that
// much, and a character the damage would have destroyed (no such event was queued for it) that survives with some of the
// damage still on it now took that damage.
export function afterCancel(state: ScenarioState, id: string, canceled: number, left: number, ctx: ReduceContext): ScenarioState {
  const trimmed = trimFollowUps(state, id, canceled);
  const card = trimmed.cards[id];
  if (!card || !inPlay(card.zone) || left <= 0) return trimmed;
  if ((trimmed.pendingEvents ?? []).some((event) => event.trigger === "damaged" && event.cardId === id)) return trimmed;
  const printed = printedOf(ctx.cards, card.code);
  if (!isCharacterType(printed) || card.damage >= modifiedStat(trimmed, card, "hitPoints", ctx.cards)) return trimmed;
  return queueHeard(trimmed, ctx, { trigger: "damaged", seat: card.controller, cardId: id, subject: id, amount: left });
}

// Takes `amount` of the damage the answered damageDealt event dealt off the damaged card: what a later cancel of the same
// damage can still take is what is left (rr.cancel). A cancel (`canceled`) of the damage the attack in progress dealt means the attack did
// not deal it, so `landed` (what a shadow effect reads as "damage dealt by this attack") loses it; redirected damage is still dealt by the attack.
export function cancelDealt(state: ScenarioState, id: string, amount: number, dealt: number, ctx: ReduceContext, canceled = false): ScenarioState {
  const card = state.cards[id];
  if (!card || amount <= 0) return state;
  const lowered = updateCard(state, id, { damage: card.damage - amount });
  const removed = canceled ? lowerLanded(lowered, id, amount) : lowered;
  const data = topFrame(removed)?.data;
  const patched = data?.kind === "effect" ? patchTop(removed, { data: { ...data, dealt: dealt - amount } }) : removed;
  return afterCancel(patched, id, amount, dealt - amount, ctx);
}

// The attack in progress keeps the damage it landed only while a shadow effect reads it (noteLanded): the cancel takes its share off.
function lowerLanded(state: ScenarioState, id: string, amount: number): ScenarioState {
  const attack = state.pendingAttack;
  const landed = attack?.defense?.landed;
  if (!attack || !landed) return state;
  const target = afterTarget(attack);
  if (!target || (id !== target && id !== damageGoesTo(state, target, "combat"))) return state;
  return { ...state, pendingAttack: { ...attack, defense: { ...attack.defense, landed: Math.max(0, landed - amount) } } };
}

// "Place that damage on ~ instead": the damage just dealt to the event's card moves to another card in play.
export function redirectDamage(state: ScenarioState, instruction: Extract<Instruction, { verb: "RedirectDamage" }>, seat: number, sourceId: string | null, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const scope = frameScope(state, seat, sourceId);
  const from = refCard(state, "subject", scope) ?? "";
  const to = refCard(state, instruction.to, scope) ?? "";
  const card = state.cards[from];
  const target = state.cards[to];
  const dealt = scope.dealt ?? 0;
  if (!card || !target || from === to || !inPlay(target.zone) || dealt <= 0) return state;
  const amount = Math.min(dealt, card.damage, instruction.all ? dealt : resolveAmount(state, instruction.amount ?? 1, scope, ctx));
  if (amount <= 0) return state;
  return placeDamage(cancelDealt(state, from, amount, dealt, ctx), to, amount, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED));
}

// "Attached hero takes all damage assigned to the chosen hero": damage assigned to a card that holds damageToSourceHost goes to
// the host of that modifier's source while the host is in play.
export function damageGoesTo(state: ScenarioState, id: string, source?: DamageSource): string {
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "damageToSourceHost" || modifier.instanceId !== id || modifier.amount <= 0 || !modifierActive(state, modifier)) continue;
    const host = state.cards[modifier.sourceId]?.host;
    if (host && host !== id && inPlay(state.cards[host]?.zone ?? "removed")) return host;
  }
  // "Any damage dealt by this attack is dealt to the hero with Alcaron's Scroll attached, if able" (05020:A:2): the pelargir family names the hero, or none.
  // "Any damage that would be dealt to a Captain enemy is dealt to 1 Morgul Bodyguard instead" (06148:A:1): the Captain holds the flag while a Bodyguard is in play.
  return scrollDamageTarget(state, id, source) ?? bodyguardTarget(state, id) ?? id;
}

// Damage a card does not take from this source: Bilbo Baggins in the riddle area takes it only from Gollum (families/riddles/gollum.ts).
export function damageBarred(state: ScenarioState, id: string, source: string, sourceId: string | null | undefined): boolean {
  return bilboDamageBarred(state, id, source, sourceId);
}

// Characters of any player that may take the damage of an undefended attack against `seat` because a card that player controls
// says so ("Damage from undefended attacks against you may be assigned to attached ally").
export function undefendedExtras(state: ScenarioState, seat: number, cards: Cards): string[] {
  const found: string[] = [];
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "undefendedForSourceController" || modifier.amount <= 0 || !modifierActive(state, modifier)) continue;
    if (state.cards[modifier.sourceId]?.controller !== seat || found.includes(modifier.instanceId)) continue;
    const holder = state.cards[modifier.instanceId];
    if (holder?.controller == null || !characters(state, holder.controller, cards).includes(holder.id)) continue;
    found.push(holder.id);
  }
  return found;
}

// A character that uses its Willpower instead of its Defense (Against the Shadow, 06038), always or, with a `defendingAgainst` condition on the modifier, only while it defends against an enemy with the Trait ("when defending against Wight enemies", 148010:A:1).
// modifiedStat takes the printed cards and no effect list (as keywords.ts reads the same condition for a Defense bonus), so the Trait is read from the enemy's printed traits and the traits the state grants it, not from a constant record that grants one.
export function defenseFromWillpower(state: ScenarioState, instance: CardInstance, cards: ReadonlyMap<string, PrintedCard>): boolean {
  return state.modifiers.some(
    (modifier) =>
      modifier.stat === "defenseFromWillpower" &&
      modifier.instanceId === instance.id &&
      modifier.amount > 0 &&
      modifierActive(state, modifier) &&
      (modifier.when?.kind !== "defendingAgainst" || defendingAgainst(state, instance, modifier.when.trait, { effects: [], cards })),
  );
}

// Progress from questing successfully (rr.step-3-4): the active location takes what it needs first, and while an enemy holds
// takesQuestProgress the rest is assigned to it as damage instead of being placed on the quest (Ride Them Down, 08142).
export function placeQuestingProgress(state: ScenarioState, amount: number, cards: Cards, steps: EngineStep[], canAdvance: (state: ScenarioState) => boolean, causeOf?: QuestDamageCause): ScenarioState {
  const enemy = Object.values(state.cards).find((card) => inPlay(card.zone) && printedOf(cards, card.code).type === "enemy" && flagged(state, card.id, "takesQuestProgress"));
  if (!enemy) return placeQuestProgress(state, amount, cards, steps, canAdvance, true);
  const location = state.activeLocation ? state.cards[state.activeLocation] : undefined;
  const points = location ? questPointsOf(state, location, cards) : null;
  const toLocation = location && points != null ? Math.min(amount, Math.max(0, points - location.progress)) : 0;
  const placed = toLocation > 0 ? placeQuestProgress(state, toLocation, cards, steps, canAdvance, true) : state;
  const rest = amount - toLocation;
  // The damage is the effect of the card that set the flag: its record is the cause.
  const holder = state.modifiers.find((modifier) => modifier.stat === "takesQuestProgress" && modifier.instanceId === enemy.id && modifierActive(state, modifier));
  const cause = (holder ? causeOf?.(holder.sourceId) : undefined) ?? currentCause(steps, UNATTRIBUTED);
  return rest > 0 && placed.cards[enemy.id] ? placeDamage(placed, enemy.id, rest, cards, steps, "player", cause) : placed;
}

/** The record of the card with this id that holds the flag `takesQuestProgress`, as the cause of the damage it assigns. */
export type QuestDamageCause = (sourceId: string) => Cause | undefined;

export function questDamageCause(state: ScenarioState, ctx: ReduceContext): QuestDamageCause {
  return (sourceId) => {
    const effect = effectsOf(ctx, state.cards[sourceId]?.code ?? "").find((record) => record.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "takesQuestProgress"));
    return effect ? effectCause(effect) : undefined;
  };
}

// Each character that took damage from the enemy attack in progress hears it ("After attached hero takes damage from an enemy
// attack", "After Dark Bats damages a character"): the characters whose damage went up between the two states; the enemy making the
// attack is the event's other card. A character that damage destroyed took it all the same (rr.damage: the damage is placed, then the
// card is destroyed): its event is queued after the leftPlay events and before characterDestroyed, and the cards still in play hear it
// (rr.forced). The attachments of the dead character left play with it (rr.attachment-cards), so a Response of theirs, used only after
// the trigger is resolved (rr.response), is not offered; an effect on another card does nothing to a card that is no longer in play.
export function noteAttackDamage(before: ScenarioState, damaged: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // A family may act on the damage (an enemy with Venom gives each character it damaged 1 poison: hob.venom-poison, families/poison/venom.ts).
  const after = familyAttackDamaged(before, damaged, ctx, steps);
  if (!listened(after, ctx, ["damagedByAttack"])) return after;
  let next = after;
  for (const now of Object.values(after.cards)) {
    const was = before.cards[now.id];
    if (!was || !inPlay(was.zone) || now.damage <= was.damage || !isCharacterType(printedOf(ctx.cards, now.code))) continue;
    const event: GameEvent = { trigger: "damagedByAttack", seat: was.controller, cardId: now.id, subject: now.id, amount: now.damage - was.damage, ...(after.pendingAttack ? { other: after.pendingAttack.enemyId } : {}) };
    next = inPlay(now.zone) ? queueEvent(next, event) : queueBeforeDestruction(next, event);
  }
  return next;
}

// The event of damage that destroyed its card goes ahead of that card's "destroyed" event: the damage is heard before the destruction.
function queueBeforeDestruction(state: ScenarioState, event: GameEvent): ScenarioState {
  const pending = state.pendingEvents ?? [];
  const at = pending.findIndex((one) => one.trigger === "characterDestroyed" && one.subject === event.subject);
  return at < 0 ? queueEvent(state, event) : { ...state, pendingEvents: [...pending.slice(0, at), event, ...pending.slice(at)] };
}

/** The card an attack damaged: the undefended hero, or the defender. */
export function afterTarget(attack: PendingAttack): string | undefined {
  return attack.undefended || !attack.defenderId ? attack.heroId : attack.defenderId;
}

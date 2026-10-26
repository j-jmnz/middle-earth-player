// Rules: rr.exhausted, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.damage, rr.explored, rr.cancel, rr.shadow-effects, rr.restricted, rr.initiating-abilities-playing-cards (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "./amounts.ts";
import { currentCause, UNATTRIBUTED } from "./cause.ts";
import { characters, strikeEnemy } from "./combat.ts";
import { enforceRestricted } from "./attach.ts";
import { placeProgress } from "./effect-verbs.ts";
import { queueEvent } from "./queue.ts";
import { shuffleIds } from "./seed.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { lowerThreat, placeDamage } from "./keywords.ts";
import { stagingLocations } from "./quest.ts";
import type { ScenarioState } from "./state.ts";
import { inPlay, livingSeats, updateCard, withSeat, withThreat } from "./state.ts";
import { printedOf } from "./printed.ts";
import { patchTop, topFrame } from "./windows.ts";
import { attachTo, moveCard } from "./zones.ts";

// Verbs of the player cards. A Pick (effect-frames.ts) chooses a card or a player and the verbs after it act on the choice.
export type PlayerFocus = { seat: number; sourceId: string | null };

export function pickedList(state: ScenarioState): readonly string[] {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? (data.picked ?? []) : [];
}

// The last thing a Pick chose: a card id, "seat:N" for a player, or "" when there was nothing to choose.
export function lastPicked(state: ScenarioState): string {
  return pickedList(state).at(-1) ?? "";
}

// "seat:1" -> 1.
export function seatOf(picked: string): number | null {
  const match = /^seat:(\d+)$/.exec(picked);
  return match ? Number(match[1]) : null;
}

// The seat after `seat` that is still in the game, or null when the player is alone.
export function otherSeat(state: ScenarioState, seat: number): number | null {
  const living = livingSeats(state);
  const at = living.indexOf(seat);
  const next = living[(at + 1) % living.length];
  return next == null || next === seat ? null : next;
}

// The seats a verb names: the actor's, each living one, the picked player's, or the one the answered event happened to.
export function seatsFor(state: ScenarioState, who: "actor" | "picked" | "eachSeat" | "eventSeat" | "firstPlayer", actor: number): number[] {
  if (who === "eachSeat") return livingSeats(state);
  if (who === "firstPlayer") return [state.firstPlayer];
  if (who === "picked") {
    const seat = seatOf(lastPicked(state));
    return seat == null ? [] : [seat];
  }
  if (who === "eventSeat") {
    const data = topFrame(state)?.data;
    const seat = data?.kind === "effect" ? data.eventSeat : null;
    return seat == null ? [] : [seat];
  }
  return [actor];
}

// Returns the new state when the instruction is one of these verbs, otherwise null.
export function runPlayerVerb(
  state: ScenarioState,
  instruction: Instruction,
  focus: PlayerFocus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState | null {
  switch (instruction.verb) {
    case "Ready": {
      if (instruction.target === "picked" || instruction.target === "subject" || instruction.target === "defender") {
        const id = refCard(state, instruction.target, frameScope(state, focus.seat, focus.sourceId)) ?? "";
        return state.cards[id] ? readyCard(state, id) : state;
      }
      if (instruction.target === "host") {
        const hostId = focus.sourceId ? state.cards[focus.sourceId]?.host : null;
        return hostId && state.cards[hostId] ? updateCard(state, hostId, { exhausted: false }) : state;
      }
      if (instruction.target !== "allCharacters") return null;
      let next = state;
      for (const seat of livingSeats(state)) for (const id of characters(state, seat, ctx.cards)) next = updateCard(next, id, { exhausted: false });
      return next;
    }
    case "Exhaust": {
      if (instruction.target?.kind !== "picked" && instruction.target?.kind !== "ref") return null;
      const ref = instruction.target.kind === "ref" ? instruction.target.ref : "picked";
      const id = refCard(state, ref, frameScope(state, focus.seat, focus.sourceId)) ?? "";
      return state.cards[id] ? exhaustCard(state, id) : state;
    }
    case "Heal": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      const id = refCard(state, instruction.target ?? "picked", scope) ?? "";
      const card = state.cards[id];
      if (!card || card.damage <= 0) return state;
      const amount = instruction.all ? card.damage : Math.min(card.damage, resolveAmount(state, instruction.amount ?? 1, scope, ctx));
      if (amount <= 0) return state;
      return queueEvent(updateCard(state, id, { damage: card.damage - amount }), { trigger: "healed", seat: card.controller, cardId: id });
    }
    case "PutOnDeck": {
      const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId)) ?? "";
      return putOnDeck(state, id, instruction.position);
    }
    case "MoveResources": {
      const list = pickedList(state);
      const from = state.cards[list.at(-2) ?? ""];
      const to = state.cards[list.at(-1) ?? ""];
      if (!from || !to || from.id === to.id) return state;
      const amount = instruction.all ? from.resources : Math.min(from.resources, resolveAmount(state, instruction.amount ?? 1, frameScope(state, focus.seat, focus.sourceId), ctx));
      if (amount <= 0) return state;
      return updateCard(updateCard(state, from.id, { resources: from.resources - amount }), to.id, { resources: to.resources + amount });
    }
    case "AddToVictory": {
      const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId)) ?? "";
      return state.cards[id] ? moveCard(state, id, { zone: "victory" }) : state;
    }
    case "CancelDamage": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      const id = refCard(state, instruction.target ?? "subject", scope) ?? "";
      const card = state.cards[id];
      const dealt = scope.dealt ?? 0;
      if (!card || dealt <= 0) return state;
      const amount = Math.min(dealt, card.damage, instruction.all ? dealt : resolveAmount(state, instruction.amount ?? 1, scope, ctx));
      if (amount <= 0) return state;
      const data = topFrame(state)?.data;
      const canceled = updateCard(state, id, { damage: card.damage - amount });
      // What is left of the damage is what a later cancel of the same damage can take.
      return data?.kind === "effect" ? patchTop(canceled, { data: { ...data, dealt: dealt - amount } }) : canceled;
    }
    case "ReduceNextCost": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      const seat = instruction.who === "picked" ? seatOf(lastPicked(state)) : focus.seat;
      const amount = resolveAmount(state, instruction.amount, scope, ctx);
      if (seat == null || amount <= 0) return state;
      const discount = { seat, sourceId: focus.sourceId ?? "", pick: instruction.pick, amount, until: instruction.until, ...(instruction.min != null ? { min: instruction.min } : {}) };
      return { ...state, discounts: [...(state.discounts ?? []), discount] };
    }
    case "SetThreat":
      return withThreat(state, focus.seat, instruction.value);
    case "LowerThreat": {
      const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
      let next = state;
      for (const seat of seatsFor(state, instruction.who, focus.seat)) next = lowerThreat(next, seat, amount, steps, currentCause(steps, UNATTRIBUTED));
      return next;
    }
    case "DamageCard": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      const id = refCard(state, instruction.target ?? "picked", scope) ?? "";
      const amount = resolveAmount(state, instruction.amount, scope, ctx);
      return state.cards[id] && amount > 0 ? placeDamage(state, id, amount, ctx.cards, steps, "player", currentCause(steps, UNATTRIBUTED)) : state;
    }
    case "PlaceProgressOn": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      const targets =
        instruction.target === "eachStagingLocation"
          ? stagingLocations(state, ctx.cards)
          : [refCard(state, instruction.target === "self" ? "self" : instruction.target, scope) ?? ""];
      const amount = resolveAmount(state, instruction.amount, scope, ctx);
      let next = state;
      for (const id of targets) if (next.cards[id] && amount > 0) next = placeProgress(next, id, amount, ctx, steps);
      return next;
    }
    case "GiveControl": {
      const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      const seat = otherSeat(state, focus.seat);
      if (!source || seat == null) return state;
      return updateCard(moveCard(state, source.id, { zone: "play", seat }), source.id, { owner: source.owner ?? source.controller ?? focus.seat });
    }
    case "DiscardPicked": {
      const id = lastPicked(state);
      const card = state.cards[id];
      const seat = card?.owner ?? card?.controller;
      if (!card || seat == null) return state;
      const moved = moveCard(state, id, { zone: "discard", seat });
      // "After 1 or more cards are discarded from your hand", "After ~ is discarded from your deck".
      if (card.zone === "hand") return queueEvent(moved, { trigger: "discardedFromHand", seat, cardId: id });
      if (card.zone === "deck") return queueEvent(moved, { trigger: "discardedFromDeck", seat, cardId: id });
      return moved;
    }
    case "DiscardTopOfDeck": {
      const top = state.seats[focus.seat]?.deck[0];
      const card = top ? state.cards[top] : undefined;
      if (!top || !card) return state;
      const discarded = queueEvent(moveCard(state, top, { zone: "discard", seat: focus.seat }), { trigger: "discardedFromDeck", seat: focus.seat, cardId: top });
      const data = topFrame(discarded)?.data;
      // The discarded card's printed cost is the effect's X.
      return data?.kind === "effect" ? patchTop(discarded, { data: { ...data, x: printedOf(ctx.cards, card.code).cost ?? 0 } }) : discarded;
    }
    case "AddSourceToVictory":
      return focus.sourceId && state.cards[focus.sourceId] ? moveCard(state, focus.sourceId, { zone: "victory" }) : state;
    case "ExchangeWithDeckTop": {
      const handId = lastPicked(state);
      const seat = state.seats[focus.seat];
      const top = seat?.deck[0];
      if (!seat || !top || !state.cards[handId]) return state;
      const swapped = moveCard(moveCard(state, top, { zone: "hand", seat: focus.seat }), handId, { zone: "deck", seat: focus.seat });
      const pile = swapped.seats[focus.seat];
      if (!pile) return swapped;
      // The card from the hand goes on top of the deck, not under it.
      return withSeat(swapped, focus.seat, { ...pile, deck: [handId, ...pile.deck.filter((id) => id !== handId)] });
    }
    case "DiscardShadow": {
      const enemy = state.cards[lastPicked(state)];
      return enemy?.shadowId ? moveCard(state, enemy.shadowId, { zone: "encounterDiscard" }) : state;
    }
    case "CancelEffect":
      return cancelAnswered(state);
    case "LookAtEncounterTop": {
      const top = state.encounterDeck[0];
      return top ? { ...state, window: { kind: "look", seat: focus.seat, cardIds: [top] }, activeSeat: focus.seat, passed: [] } : state;
    }
    case "ShuffleDeck": {
      const seat = state.seats[focus.seat];
      if (!seat) return state;
      const shuffled = shuffleIds(seat.deck, state.seed, state.seedCursor);
      return { ...withSeat(state, focus.seat, { ...seat, deck: shuffled.ids }), seedCursor: shuffled.cursor };
    }
    case "MovePicked": {
      const id = lastPicked(state);
      const card = state.cards[id];
      if (!card) return state;
      // A card out of a deck or a discard pile goes to its own player's hand.
      if (instruction.to === "hand") return moveCard(state, id, { zone: "hand", seat: card.controller ?? focus.seat });
      const seat = instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat;
      // An ally taken from another player's discard pile is put into play under the new controller and stays its owner's card.
      const owner = card.controller != null && card.controller !== seat && card.owner == null ? { owner: card.controller } : {};
      const entered = updateCard(moveCard(state, id, { zone: "play", seat }), id, { exhausted: false, ...owner });
      return queueEvent(entered, { trigger: "enteredPlay", seat, cardId: id });
    }
    case "ReturnToHand": {
      const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId)) ?? "";
      const card = state.cards[id];
      if (!card || !inPlay(card.zone) || card.controller == null) return state;
      const returned = moveCard(state, id, { zone: "hand", seat: card.owner ?? card.controller });
      return queueEvent(returned, { trigger: "allyLeftPlay", seat: card.controller, subject: id });
    }
    case "ShuffleSelfIntoDeck": {
      // Only a card still in play is shuffled back: once Beorn has left play (returned to the hand by Sneak Attack, or
      // destroyed), the effect no longer applies to him (faq.simultaneous-effects). Leaving play this way is heard by
      // "after an ally card leaves play" (Valiant Sacrifice).
      const card = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      if (!card || !inPlay(card.zone) || card.controller == null) return state;
      const seat = card.owner ?? card.controller;
      const moved = moveCard(state, card.id, { zone: "deck", seat });
      const pile = moved.seats[seat];
      if (!pile) return moved;
      const shuffled = shuffleIds(pile.deck, moved.seed, moved.seedCursor);
      const done = { ...withSeat(moved, seat, { ...pile, deck: shuffled.ids }), seedCursor: shuffled.cursor };
      return queueEvent(done, { trigger: "allyLeftPlay", seat: card.controller, subject: card.id });
    }
    case "AttachPicked": {
      const list = pickedList(state);
      const attachment = list.at(-2) ?? "";
      const host = list.at(-1) ?? "";
      if (!state.cards[attachment] || !state.cards[host]) return state;
      const placed = updateCard(moveCard(state, attachment, { zone: "play", seat: focus.seat }), attachment, { exhausted: false });
      const attached = queueEvent(attachTo(placed, attachment, host), { trigger: "enteredPlay", seat: focus.seat, cardId: attachment });
      return enforceRestricted(attached, host, ctx, steps);
    }
    case "AttackEnemy": {
      const list = pickedList(state);
      const attackerId = list.at(-2) ?? "";
      const enemyId = list.at(-1) ?? "";
      const attacker = state.cards[attackerId];
      if (!attacker || !state.cards[enemyId] || attacker.controller == null) return state;
      return strikeEnemy(state, attacker.controller, enemyId, [attackerId], ctx, steps);
    }
    default:
      return null;
  }
}

// A Response to "the when revealed effects are about to resolve" or "the shadow effect has just triggered" cancels it. The
// frame under the response frame is the effect; the shadow effect is the pending attack's.
function cancelAnswered(state: ScenarioState): ScenarioState {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame?.data.kind !== "responses") continue;
    const trigger = frame.data.event.trigger;
    if (trigger === "shadowPending") {
      return state.pendingAttack ? { ...state, pendingAttack: { ...state.pendingAttack, shadowCanceled: true } } : state;
    }
    if (trigger === "encounterRevealed") {
      const target = state.stack[index - 1];
      if (target?.data.kind !== "reveal") return state;
      const stack = state.stack.map((entry, at) => (at === index - 1 && entry.data.kind === "reveal" ? { ...entry, data: { ...entry.data, canceled: true } } : entry));
      return { ...state, stack };
    }
    if (trigger !== "whenRevealedPending") continue;
    const target = state.stack[index - 1];
    if (target?.data.kind !== "effect") return state;
    const stack = state.stack.map((entry, at) => (at === index - 1 && entry.data.kind === "effect" ? { ...entry, data: { ...entry.data, canceled: true } } : entry));
    return { ...state, stack };
  }
  return state;
}

// A card readies or exhausts, and the Responses that hear it are told ("After ~ readies", "After ~ exhausts").
export function readyCard(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  if (!card?.exhausted) return state;
  return queueEvent(updateCard(state, id, { exhausted: false }), { trigger: "readied", seat: card.controller, cardId: id });
}

export function exhaustCard(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  if (!card || card.exhausted) return state;
  return queueEvent(updateCard(state, id, { exhausted: true }), { trigger: "exhausted", seat: card.controller, cardId: id });
}

// A player card goes on top or at the bottom of its owner's deck, or is shuffled in. Only a player card has a deck to go to.
export function putOnDeck(state: ScenarioState, id: string, position: "top" | "bottom" | "shuffle"): ScenarioState {
  const card = state.cards[id];
  const seat = card ? (card.owner ?? card.controller) : null;
  if (!card || seat == null) return state;
  const moved = moveCard(state, id, { zone: "deck", seat });
  const pile = moved.seats[seat];
  if (!pile) return moved;
  const rest = pile.deck.filter((entry) => entry !== id);
  if (position === "top") return withSeat(moved, seat, { ...pile, deck: [id, ...rest] });
  if (position === "bottom") return withSeat(moved, seat, { ...pile, deck: [...rest, id] });
  const shuffled = shuffleIds(pile.deck, moved.seed, moved.seedCursor);
  return { ...withSeat(moved, seat, { ...pile, deck: shuffled.ids }), seedCursor: shuffled.cursor };
}

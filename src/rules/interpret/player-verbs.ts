// Rules: rr.exhausted, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.damage, rr.explored, rr.cancel, rr.shadow-effects, rr.restricted, rr.initiating-abilities-playing-cards (data/rules/entries.json).
import { counterCancel } from "../families/pelennor/combat.ts";
import { bonesCancel } from "../families/wizards-quest/khazad.ts";
import { sendAway } from "../families/objectives/claimed.ts";
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "./amounts.ts";
import { currentCause, UNATTRIBUTED } from "../core/cause.ts";
import { characters } from "../combat/combat.ts";
import { declareAttack } from "../families/attack/index.ts";
import { enforceRestricted } from "../player/attach.ts";
import { placeProgress, progressPlacer } from "./effect-verbs.ts";
import { queueEvent } from "../windows/queue.ts";
import { announceAllyLeft } from "../core/ally-left.ts";
import { announceTopDiscard } from "../families/deck/pressure.ts";
import { shuffleIds } from "../core/seed.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { lowerThreatByEffect, playerSource } from "../families/quest/threat.ts";
import { destroyCard, placeDamage } from "../core/keywords.ts";
import { stagingLocations } from "../quest/quest.ts";
import type { CardInstance, ScenarioState } from "../core/state.ts";
import { flagged, inPlay, livingSeats, updateCard, withSeat, withThreat } from "../core/state.ts";
import { printedOf, scenarioOwned, type PrintedCard } from "../core/printed.ts";
import { readyBarred, readyPatch } from "../core/holder-classes.ts";
import { titleBarred } from "../families/nightmare/guards.ts";
import { patchTop, topFrame } from "../windows/windows.ts";
import { attachTo, discardFromHand, moveCard } from "../core/zones.ts";
import { afterCancel } from "../families/defense/damage.ts";
import { healBlocked } from "../families/burden/life.ts";
import { healDamage } from "../families/dreamchaser/heal-cap.ts";
import { mayGainResources } from "../families/misc/guards.ts";
import { addToVictory } from "../families/sidequests/victory.ts";
import { placeSideQuest } from "../families/sidequests/play.ts";
import { isQuestSource } from "../families/wilderland/night-quest.ts";
import { announceCanceled } from "../families/nightmare/index.ts";
import { immuneTo } from "./immune-targets.ts";

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
      if (instruction.target === "picked" || instruction.target === "subject" || instruction.target === "defender" || instruction.target === "other") {
        const id = refCard(state, instruction.target, frameScope(state, focus.seat, focus.sourceId)) ?? "";
        return state.cards[id] ? readyCard(state, id, playerSource(state, focus.sourceId, ctx), ctx.cards) : state;
      }
      if (instruction.target === "host") {
        const hostId = refCard(state, "host", frameScope(state, focus.seat, focus.sourceId));
        // Every ready is heard ("After Wellinghall Preserver readies", 10061:A:3; Weighed Down, 18027:A:1).
        return hostId && state.cards[hostId] ? readyCard(state, hostId, playerSource(state, focus.sourceId, ctx), ctx.cards) : state;
      }
      if (instruction.target !== "allCharacters") return null;
      let next = state;
      for (const seat of livingSeats(state)) for (const id of characters(state, seat, ctx.cards)) next = readyCard(next, id, playerSource(state, focus.sourceId, ctx), ctx.cards);
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
      if (!card || card.damage <= 0 || healBlocked(state, id)) return state;
      // "No more than 1 damage can be healed from each character each round" (145033:A:1) leaves what room the cap has.
      const healed = healDamage(state, id, instruction.all ? card.damage : resolveAmount(state, instruction.amount ?? 1, scope, ctx), ctx, { sourceId: focus.sourceId, ...(instruction.athelas ? { athelas: true } : {}) });
      if (healed.healed <= 0) return state;
      // The step records the damage removed as a negative amount, the way a progress removal is recorded (the table's log).
      steps.push({ kind: "damage", targetId: id, amount: -healed.healed, cause: currentCause(steps, UNATTRIBUTED) });
      // The card whose effect healed is the event's other card, the healed card itself when it healed itself (Radagast's Request removes it from the game, 02061:B:2; Elrond answers a heal whose card is not Elrond, 04128:A:2); an attachment that reduced the heal is discarded after it (900608:A:2).
      const announced = queueEvent(healed.state, { trigger: "healed", seat: card.controller, cardId: id, ...(focus.sourceId ? { other: focus.sourceId } : {}), ...(playerSource(state, focus.sourceId, ctx) ? { byPlayerCard: true } : {}) });
      return healed.reducer ? destroyCard(announced, healed.reducer, ctx.cards, steps) : announced;
    }
    case "PutOnDeck": {
      const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId)) ?? "";
      const target = state.cards[id];
      // The scenario owns an encounter card (rr.ownership-and-control): it has no deck of a player to go to.
      return target && inPlay(target.zone) && scenarioOwned(printedOf(ctx.cards, target.code)) ? toEncounterDiscard(state, target) : putOnDeck(state, id, instruction.position);
    }
    case "MoveResources": {
      const list = pickedList(state);
      const from = state.cards[list.at(-2) ?? ""];
      const to = state.cards[list.at(-1) ?? ""];
      if (!from || !to || from.id === to.id || !mayGainResources(state, to.id, focus.sourceId, ctx)) return state;
      const amount = instruction.all ? from.resources : Math.min(from.resources, resolveAmount(state, instruction.amount ?? 1, frameScope(state, focus.seat, focus.sourceId), ctx));
      if (amount <= 0) return state;
      const moved = updateCard(updateCard(state, from.id, { resources: from.resources - amount }), to.id, { resources: to.resources + amount });
      return to.zone === "heroes" ? queueEvent(moved, { trigger: "resourcesMoved", seat: to.controller, cardId: to.id }) : moved;
    }
    case "AddToVictory": {
      const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId)) ?? "";
      return state.cards[id] ? addToVictory(state, id, ctx) : state;
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
      const patched = data?.kind === "effect" ? patchTop(canceled, { data: { ...data, dealt: dealt - amount } }) : canceled;
      // Damage canceled is not taken: the "took damage" events that follow it lose that much (defense family).
      return afterCancel(patched, id, amount, dealt - amount, ctx);
    }
    case "SetThreat":
      return withThreat(state, focus.seat, instruction.value);
    case "LowerThreat": {
      const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
      let next = state;
      // A player card's reduction is capped by Saruman (22054:A:1) and heard by Hobbit Pipe (141015:A:2).
      for (const seat of seatsFor(state, instruction.who, focus.seat)) next = lowerThreatByEffect(next, seat, amount, focus.sourceId, ctx, steps, currentCause(steps, UNATTRIBUTED));
      return next;
    }
    case "DamageCard": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      const id = refCard(state, instruction.target ?? "picked", scope) ?? "";
      const amount = resolveAmount(state, instruction.amount, scope, ctx);
      if (!state.cards[id] || amount <= 0) return state;
      if (playerSource(state, focus.sourceId, ctx)) return placePlayerDamage(state, focus.seat, id, amount, ctx, steps, focus.sourceId);
      // An encounter or campaign card's damage is no player card effect, so a Ship objective's immunity to those does not stop it (dcce.ship-objectives). A quest card's or a side quest's is a quest effect (Dagnir's cap, 19074:A:2).
      const placed = placeDamage(state, id, amount, ctx.cards, steps, isQuestSource(state, focus.sourceId, ctx) ? "quest" : "framework", currentCause(steps, UNATTRIBUTED));
      return instruction.uncancelable ? uncancelableDamage(placed, (state.pendingEvents ?? []).length) : placed;
    }
    case "PlaceProgressOn": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      const targets =
        instruction.target === "eachStagingLocation"
          ? stagingLocations(state, ctx.cards).filter((id) => !immuneTo(state, id, focus.sourceId, ctx))
          : [refCard(state, instruction.target === "self" ? "self" : instruction.target, scope) ?? ""];
      const amount = resolveAmount(state, instruction.amount, scope, ctx);
      let next = state;
      for (const id of targets) if (next.cards[id] && amount > 0) next = placeProgress(next, id, amount, ctx, steps, progressPlacer(next, ctx, focus.seat, focus.sourceId));
      return next;
    }
    case "GiveControl": {
      const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      const seat = otherSeat(state, focus.seat);
      if (!source || seat == null) return state;
      const given = updateCard(moveCard(state, source.id, { zone: "play", seat }), source.id, { owner: source.owner ?? source.controller ?? focus.seat });
      // "After ~ changes control".
      return queueEvent(given, { trigger: "changedControl", seat, cardId: source.id });
    }
    case "DiscardPicked": {
      const id = lastPicked(state);
      const card = state.cards[id];
      const seat = card?.owner ?? card?.controller;
      if (!card || seat == null) return state;
      // "Discarded objective cards are returned to the staging area" (01103:A:2, families/objectives/claimed.ts).
      if (card.claimed) return sendAway(state, id, { zone: "discard", seat });
      // "After 1 or more cards are discarded from your hand", "After ~ is discarded from your deck".
      if (card.zone === "hand") return discardFromHand(state, id, seat);
      const moved = moveCard(state, id, { zone: "discard", seat });
      if (card.zone === "deck") return queueEvent(moved, { trigger: "discardedFromDeck", seat, cardId: id });
      return moved;
    }
    case "DiscardTopOfDeck": {
      const top = state.seats[focus.seat]?.deck[0];
      const card = top ? state.cards[top] : undefined;
      if (!top || !card) return state;
      const discarded = announceTopDiscard(queueEvent(moveCard(state, top, { zone: "discard", seat: focus.seat }), { trigger: "discardedFromDeck", seat: focus.seat, cardId: top }), focus.seat, 1, ctx);
      const data = topFrame(discarded)?.data;
      // The discarded card's printed cost is the effect's X.
      return data?.kind === "effect" ? patchTop(discarded, { data: { ...data, x: printedOf(ctx.cards, card.code).cost ?? 0 } }) : discarded;
    }
    case "AddSourceToVictory":
      return focus.sourceId && state.cards[focus.sourceId] ? addToVictory(state, focus.sourceId, ctx) : state;
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
      // Fire-filled Trench cancels a player event's cancel of a revealed treachery (families/pelennor/combat.ts).
      return counterCancel(state, ctx) ?? bonesCancel(state, ctx, steps) ?? announceCanceled(cancelAnswered(state), state, ctx, focus.seat);
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
      // A player side quest put into play lies in the staging area, as one played does (families/sidequests/play.ts).
      if (printedOf(ctx.cards, card.code).type === "player-side-quest") return queueEvent(updateCard(placeSideQuest(state, id, seat), id, { exhausted: false, ...owner }), { trigger: "enteredPlay", seat, cardId: id });
      const entered = updateCard(moveCard(state, id, { zone: "play", seat }), id, { exhausted: false, ...owner });
      return queueEvent(entered, { trigger: "enteredPlay", seat, cardId: id });
    }
    case "ReturnToHand": {
      const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId)) ?? "";
      const card = state.cards[id];
      if (!card || !inPlay(card.zone) || card.controller == null) return state;
      // The scenario owns an encounter card (an objective-ally: Wilyador, Iârion), so it has no hand to return to: it leaves play into the encounter discard pile, the area the scenario owns (rr.ownership-and-control).
      const returned = scenarioOwned(printedOf(ctx.cards, card.code)) ? toEncounterDiscard(state, card) : moveCard(state, id, { zone: "hand", seat: card.owner ?? card.controller });
      return announceAllyLeft(returned, card, ctx.cards);
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
      return announceAllyLeft(done, card, ctx.cards);
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
    // The attack resolves with the steps of a player attack: its declaration is announced and "for this attack" ends with it
    // (families/attack.ts, the DeclareAttack of an attacker its cost exhausted).
    case "AttackEnemy":
      return declareAttack(state, { verb: "DeclareAttack", exhausted: true }, focus, ctx, steps);
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
  // No Response is open: a When Revealed effect that cancels itself ("spend 1 Fellowship resource and exhaust The One Ring to cancel this effect", 144055:A:2) is the one running on top (rr.cancel).
  const running = state.stack.at(-1);
  // A Shadow effect that any player may cancel by discarding a hero (50209:A:2, 50210:A:2) is the one running on top too.
  if ((running?.frame === "whenRevealed" || running?.frame === "shadow") && running.data.kind === "effect") return patchTop(state, { data: { ...running.data, canceled: true } });
  return state;
}

// The damage dealt events the instruction just queued (from `from` on) cannot be answered by an ability that cancels damage (DamageCard `uncancelable`; rules/windows/listen.ts hears).
function uncancelableDamage(state: ScenarioState, from: number): ScenarioState {
  const events = state.pendingEvents ?? [];
  return events.length > from ? { ...state, pendingEvents: events.map((event, index) => (index >= from && event.trigger === "damageDealt" ? { ...event, uncancelable: true as const } : event)) } : state;
}

// A card readies or exhausts, and the Responses that hear it are told ("After ~ readies", "After ~ exhausts").
export function readyCard(state: ScenarioState, id: string, byPlayerCard = false, cards?: ReadonlyMap<string, PrintedCard>): ScenarioState {
  const card = state.cards[id];
  // "Your cards cannot ready for the remainder of the round" (cannotReady, 900103:A:1).
  if (!card?.exhausted || readyBarred(state, id, byPlayerCard ? cards : undefined)) return state;
  return queueEvent(updateCard(state, id, readyPatch(state, id)), { trigger: "readied", seat: card.controller, cardId: id, ...(byPlayerCard ? { byPlayerCard: true } : {}) });
}

export function exhaustCard(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  // A character that cannot exhaust (Shadow of Fear, 03027:A:1) stays as it is.
  if (!card || card.exhausted || flagged(state, id, "cannotExhaust")) return state;
  return queueEvent(updateCard(state, id, { exhausted: true }), { trigger: "exhausted", seat: card.controller, cardId: id });
}

// A card of the scenario that a player effect takes out of play by "return" goes to the encounter discard pile, whoever controls it.
function toEncounterDiscard(state: ScenarioState, card: CardInstance): ScenarioState {
  return updateCard(moveCard(state, card.id, { zone: "encounterDiscard" }), card.id, { owner: undefined });
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

// The effect's source is a player card (not an encounter card).
// Damage a player card's effect deals for the seat that used it (DamageCard, DamageEach, DealDamage). "You cannot ... deal damage (through
// effects) to enemies with a title other than Marshland Outlaws": an enemy the seat is barred from takes none (attackOnlyTitle, 900202:A:1).
export function placePlayerDamage(state: ScenarioState, seat: number, id: string, amount: number, ctx: ReduceContext, steps: EngineStep[], sourceId?: string | null): ScenarioState {
  if (titleBarred(state, seat, id, ctx.cards)) return state;
  return placeDamage(state, id, amount, ctx.cards, steps, "player", currentCause(steps, UNATTRIBUTED), sourceId);
}

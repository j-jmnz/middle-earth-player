// Rules: rr.in-play-and-out-of-play, rr.ownership-and-control, rr.discard-pile-and-victory-display, rr.attachment-cards,
// rr.removed-from-game, rr.play-and-put-into-play, rr.search (data/rules/entries.json).
//
// The deck family's verbs that move player cards between a deck, a hand, a discard pile and play: MoveCard, PutIntoPlay,
// GivePicked, SwapPicked, ShuffleDiscardIntoDeck, ShuffleHandIntoDeck, DiscardFromDeck, AddToX and ActAs.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../amounts.ts";
import { attachmentHostIds, enforceRestricted } from "../attach.ts";
import { askTarget } from "../choices.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { releaseAttachments, uniqueBlocked } from "../keywords.ts";
import { matchesPick } from "../pick.ts";
import { lastPicked, pickedList, putOnDeck, seatOf } from "../player-verbs.ts";
import { isPlayerType, printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import { shuffleIds } from "../seed.ts";
import type { CardInstance, EffectData, ScenarioState } from "../state.ts";
import { inPlay, updateCard, withSeat } from "../state.ts";
import { patchTop, topFrame } from "../windows.ts";
import { attachTo, moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

export function effectData(state: ScenarioState): EffectData | null {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? data : null;
}

function patchData(state: ScenarioState, patch: Partial<EffectData>): ScenarioState {
  const data = effectData(state);
  return data ? patchTop(state, { data: { ...data, ...patch } }) : state;
}

// The player a card belongs to: the one whose deck it came from.
function ownerOf(card: CardInstance): number | null {
  return card.owner ?? card.controller;
}

// The zone group MoveCard's `from` names.
function zoneGroup(card: CardInstance): "hand" | "play" | "discard" | "deck" | null {
  if (inPlay(card.zone)) return "play";
  return card.zone === "hand" || card.zone === "discard" || card.zone === "deck" ? card.zone : null;
}

export function shuffleSeatDeck(state: ScenarioState, seat: number): ScenarioState {
  const pile = state.seats[seat];
  if (!pile) return state;
  const shuffled = shuffleIds(pile.deck, state.seed, state.seedCursor);
  return { ...withSeat(state, seat, { ...pile, deck: shuffled.ids }), seedCursor: shuffled.cursor };
}

// A player card leaving play: its attachments are discarded (rr.attachment-cards), it loses its tokens and state, and an ally
// is announced as having left play.
function leavePlay(state: ScenarioState, id: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone)) return state;
  const released = updateCard(releaseAttachments(state, id, ctx.cards, steps), id, { damage: 0, progress: 0, resources: 0, exhausted: false, committed: false });
  return printedOf(ctx.cards, card.code).type === "ally" ? queueEvent(released, { trigger: "allyLeftPlay", seat: card.controller, subject: id }) : released;
}

// MoveCard: the card goes to its owner's hand, deck or discard pile, or is removed from the game.
export function moveCardVerb(state: ScenarioState, instruction: Verb<"MoveCard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.card ?? "picked", frameScope(state, focus.seat, focus.sourceId)) ?? "";
  const card = state.cards[id];
  if (!card || !isPlayerType(printedOf(ctx.cards, card.code))) return state;
  const group = zoneGroup(card);
  if (instruction.from && (group == null || !instruction.from.includes(group))) return state;
  const owner = ownerOf(card);
  if (owner == null && instruction.to !== "removed") return state;
  const left = leavePlay(state, id, ctx, steps);
  switch (instruction.to) {
    case "hand":
      return moveCard(left, id, { zone: "hand", seat: owner ?? focus.seat });
    case "deckTop":
      return putOnDeck(left, id, "top");
    case "deckBottom":
      return putOnDeck(left, id, "bottom");
    case "deckShuffle":
      return putOnDeck(left, id, "shuffle");
    case "discard":
      return moveCard(left, id, { zone: "discard", seat: owner ?? focus.seat });
    case "removed":
      return moveCard(left, id, { zone: "removed" });
  }
}

// The hosts an attachment put into play may go on: those it may be attached to for the seat, that match the filter (its
// `control` read from the actor's side).
function hostsFor(state: ScenarioState, instruction: Verb<"PutIntoPlay">, card: CardInstance, seat: number, focus: Focus, ctx: ReduceContext): string[] {
  const filter = instruction.host;
  return attachmentHostIds(state, seat, card.code, ctx).filter((hostId) => {
    if (!filter) return true;
    const host = state.cards[hostId];
    if (!host) return false;
    if (filter.control === "you" && host.controller !== focus.seat) return false;
    if (filter.control === "other" && (host.controller == null || host.controller === focus.seat)) return false;
    return matchesPick(state, hostId, filter, { seat: focus.seat, sourceId: focus.sourceId, counting: true }, ctx);
  });
}

// PutIntoPlay of an attachment (the play family's verb, families/play-enter.ts): it enters play on a host the actor chooses,
// under the actor's, its owner's or the picked player's control.
export function putAttachmentIntoPlay(state: ScenarioState, instruction: Verb<"PutIntoPlay">, id: string, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || inPlay(card.zone)) return state;
  const printed = printedOf(ctx.cards, card.code);
  if (printed.type !== "attachment" || uniqueBlocked(state, printed, ctx.cards)) return state;
  const owner = ownerOf(card) ?? focus.seat;
  const seat = instruction.who === "owner" ? owner : instruction.who === "picked" ? seatOf(lastPicked(state)) : focus.seat;
  if (seat == null || !state.seats[seat] || state.seats[seat]?.eliminated) return state;
  const hosts = hostsFor(state, instruction, card, seat, focus, ctx);
  const host = focus.chosen && hosts.includes(focus.chosen) ? focus.chosen : hosts.length === 1 ? hosts[0] : undefined;
  if (!host) return hosts.length > 1 ? askTarget(state, { instruction, seat: focus.seat, chosen: null }, hosts) : state;
  let next = enforceRestricted(attachTo(moveCard(state, id, { zone: "play", seat }), id, host), host, ctx, steps);
  // A card that came from another player's deck stays that player's card (rr.ownership-and-control).
  if (owner !== seat && next.cards[id]?.owner == null) next = updateCard(next, id, { owner });
  return queueEvent(next, { trigger: "enteredPlay", seat, cardId: id });
}

// GivePicked: the card picked before the last leaves its player's hand for the hand of the player picked last, and is picked
// again for what follows.
export function givePicked(state: ScenarioState): ScenarioState {
  const list = pickedList(state);
  const id = list.at(-2) ?? "";
  const seat = seatOf(list.at(-1) ?? "");
  const card = state.cards[id];
  if (!card || card.zone !== "hand" || seat == null || card.controller === seat || state.seats[seat]?.eliminated) return state;
  const owner = ownerOf(card);
  const moved = moveCard(state, id, { zone: "hand", seat });
  const owned = owner != null && owner !== seat ? updateCard(moved, id, { owner }) : updateCard(moved, id, { owner: undefined });
  const data = effectData(owned);
  return data ? patchTop(owned, { data: { ...data, picked: [...(data.picked ?? []), id] } }) : owned;
}

// SwapPicked: the deck card picked before the last and the hand card picked last change places.
export function swapPicked(state: ScenarioState): ScenarioState {
  const list = pickedList(state);
  const deckId = list.at(-2) ?? "";
  const handId = list.at(-1) ?? "";
  const deckCard = state.cards[deckId];
  const handCard = state.cards[handId];
  if (deckCard?.zone !== "deck" || handCard?.zone !== "hand" || deckCard.controller == null || handCard.controller == null) return state;
  const deckSeat = deckCard.controller;
  const handSeat = handCard.controller;
  const at = state.seats[deckSeat]?.deck.indexOf(deckId) ?? -1;
  let next = moveCard(state, deckId, { zone: "hand", seat: handSeat });
  next = moveCard(next, handId, { zone: "deck", seat: deckSeat });
  const pile = next.seats[deckSeat];
  if (!pile || at < 0) return next;
  const rest = pile.deck.filter((entry) => entry !== handId);
  next = withSeat(next, deckSeat, { ...pile, deck: [...rest.slice(0, at), handId, ...rest.slice(at)] });
  // The card from the hand is one of the cards the effect looked at now ("return the 3 cards to the top of your deck").
  const looked = effectData(next)?.looked;
  return looked ? patchData(next, { looked: looked.map((entry) => (entry === deckId ? handId : entry)) }) : next;
}

// ShuffleDiscardIntoDeck: the player's discard pile goes into their deck, which is shuffled.
export function shuffleDiscardIn(state: ScenarioState, instruction: Verb<"ShuffleDiscardIntoDeck">, focus: Focus): ScenarioState {
  const seat = instruction.who === "picked" ? seatOf(lastPicked(state)) : focus.seat;
  if (seat == null || !state.seats[seat]) return state;
  let next = state;
  for (const id of [...(state.seats[seat]?.discard ?? [])]) next = moveCard(next, id, { zone: "deck", seat });
  return shuffleSeatDeck(next, seat);
}

// ShuffleHandIntoDeck: the actor's hand (but the card resolving) goes into their deck, which is shuffled; X is how many.
export function shuffleHandIn(state: ScenarioState, focus: Focus): ScenarioState {
  const hand = (state.seats[focus.seat]?.hand ?? []).filter((id) => id !== focus.sourceId);
  let next = state;
  for (const id of hand) next = moveCard(next, id, { zone: "deck", seat: focus.seat });
  return patchData(shuffleSeatDeck(next, focus.seat), { x: hand.length });
}

// DiscardFromDeck: the top cards of the actor's deck go to the discard pile, announced; they are the cards the effect looked
// at, and `count` sets X to how many of them match and picks the first one that does.
export function discardFromDeck(state: ScenarioState, instruction: Verb<"DiscardFromDeck">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const amount = resolveAmount(state, instruction.amount, scope, ctx);
  const floor = instruction.costAtLeast == null ? null : resolveAmount(state, instruction.costAtLeast, scope, ctx);
  let next = instruction.shuffle ? shuffleSeatDeck(state, focus.seat) : state;
  const top = (next.seats[focus.seat]?.deck ?? []).slice(0, Math.max(0, amount));
  for (const id of top) next = queueEvent(moveCard(next, id, { zone: "discard", seat: focus.seat }), { trigger: "discardedFromDeck", seat: focus.seat, cardId: id });
  next = patchData(next, { looked: top });
  const count = instruction.count;
  if (!count) return next;
  const at = { seat: focus.seat, sourceId: focus.sourceId, counting: true, ...(scope.x != null ? { x: scope.x } : {}) };
  const matching = top.filter((id) => {
    const card = next.cards[id];
    if (!card || !matchesPick(next, id, count, at, ctx)) return false;
    const cost = printedOf(ctx.cards, card.code).cost;
    return floor == null || (cost != null && cost >= floor);
  });
  const data = effectData(next);
  return data ? patchTop(next, { data: { ...data, x: matching.length, picked: [...(data.picked ?? []), matching[0] ?? ""] } }) : next;
}

// AddToX: the effect's X grows by the amount.
export function addToX(state: ScenarioState, instruction: Verb<"AddToX">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  return patchData(state, { x: (scope.x ?? 0) + resolveAmount(state, instruction.amount, scope, ctx) });
}

// ActAs: the rest of the effect resolves for the last picked player, or for the effect's actor again.
export function actAs(state: ScenarioState, instruction: Verb<"ActAs">): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  const player = [...(data.picked ?? [])].reverse().find((entry) => seatOf(entry) != null);
  const seat = instruction.who === "actor" ? data.actor : seatOf(player ?? "");
  if (seat == null || !state.seats[seat] || state.seats[seat]?.eliminated) return state;
  return patchTop(state, { data: { ...data, queue: data.queue.map((item) => ({ ...item, seat })) } });
}

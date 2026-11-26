// Rules: rr.encounter-deck, rr.search, rr.active-location, rr.travel, rr.attachment-cards, rr.in-play-and-out-of-play,
// rr.effects (data/rules/entries.json).
//
// Encounter cards that player card effects look at and move: the top of the encounter deck, its discard pile, the staging
// area, the active location.
import { announceLooked } from "./looked.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { releaseAttachments } from "../../core/keywords.ts";
import { pickedList, seatOf } from "../../interpret/player-verbs.ts";
import { isLocationId, printedOf, type CardType } from "../../core/printed.ts";
import { engageWith } from "../../quest/quest.ts";
import { queueEvent } from "../../windows/queue.ts";
import { travelBlocked } from "../../interpret/restrictions.ts";
import { effectsOf } from "../../windows/listen.ts";
import { fireForced } from "../../windows/triggers.ts";
import type { EffectData, ScenarioState } from "../../core/state.ts";
import { flagged, heldHero, inPlay, updateCard } from "../../core/state.ts";
import { travelNow } from "../../quest/travel.ts";
import { shuffleEncounterDeck, shuffleIntoEncounterDeck } from "../../interpret/verbs.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { moveCard, moveToEncounterDeckDown } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { addedToStaging, announceEntered } from "./reveal.ts";
import { stagingDest } from "../breaking/areas.ts";
import { freeSlot, makeActiveIn } from "../south/locations.ts";

type MoveInstruction = Extract<Instruction, { verb: "MoveEncounterCard" }>;
export type EncounterDestination = MoveInstruction["to"];

// The running effect's data, when an effect frame is on top.
export function effectData(state: ScenarioState): EffectData | null {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? data : null;
}

// The card becomes the last picked card of the running effect ("" when there is none).
export function pushPicked(state: ScenarioState, id: string | null | undefined): ScenarioState {
  const data = effectData(state);
  return data ? patchTop(state, { data: { ...data, picked: [...(data.picked ?? []), id ?? ""] } }) : state;
}

// The set-aside card with this title (the first in set-aside order).
export function setAsideNamed(state: ScenarioState, name: string, ctx: ReduceContext): string | undefined {
  return state.setAside.find((other) => printedOf(ctx.cards, state.cards[other]?.code ?? "").name === name);
}

export function typeOf(state: ScenarioState, id: string | null | undefined, ctx: ReduceContext): CardType | null {
  const card = id ? state.cards[id] : undefined;
  return card ? printedOf(ctx.cards, card.code).type : null;
}

// The card a MoveEncounterCard names: a reference, the card picked before the last, or the top card of the encounter deck or
// of its discard pile (the last card put there).
export function encounterCard(state: ScenarioState, card: MoveInstruction["card"], focus: Focus): string | null {
  if (card === "deckTop") return state.encounterDeck[0] ?? null;
  if (card === "discardTop") return state.encounterDiscard.at(-1) ?? null;
  if (card === "previous") return pickedList(state).at(-2) || null;
  return refCard(state, card ?? "picked", frameScope(state, focus.seat, focus.sourceId));
}

// A card that leaves play loses what it had in play: its attachments are discarded (rr.attachment-cards) and its tokens go.
export function leavePlay(state: ScenarioState, id: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone)) return state;
  const left = updateCard(releaseAttachments(state, id, ctx.cards, steps), id, { damage: 0, progress: 0, resources: 0, exhausted: false });
  // The card is announced to the abilities that hear it leave play ("After this location leaves play", 141049:A:2). moveCard announces a card that leaves a
  // player's area, an attachment, an ally a guard holds in the staging area and an enemy that guards a hero; an explored location is announced where it is explored
  // (quest/stage-reveal.ts).
  const guardedAlly = card.zone === "staging" && state.modifiers.length > 0 && flagged(state, id, "guardedAlly");
  const announcedElsewhere = card.zone === "play" || card.zone === "heroes" || card.zone === "attached" || guardedAlly || Object.values(state.cards).some((other) => heldHero(other) && other.host === id);
  return announcedElsewhere ? left : queueEvent(left, { trigger: "leftPlay", seat: null, cardId: id });
}

/** A card in play goes facedown underneath a host, out of play (rr.in-play-and-out-of-play): what it had in play is lost, `placedUnder` is queued about it and the table is told it is destroyed. */
export function placeUnderHost(state: ScenarioState, id: string, host: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const left = leavePlay(releaseAttachments(state, id, ctx.cards, steps), id, ctx, steps);
  steps.push({ kind: "destroy", targetId: id, under: true });
  return queueEvent(moveCard(left, id, { zone: "under", locationId: host }), { trigger: "placedUnder", seat: null, subject: id });
}

function toDeck(state: ScenarioState, id: string, top: boolean): ScenarioState {
  const put = moveToEncounterDeckDown(state, id);
  if (!put.moved) return put.state;
  const moved = put.state;
  const rest = moved.encounterDeck.filter((entry) => entry !== id);
  return { ...moved, encounterDeck: top ? [id, ...rest] : [...rest, id] };
}

// A card moved out of the cards a look showed is no longer one of them (ArrangeEncounter puts back only those still on top).
function forgetLooked(state: ScenarioState, id: string): ScenarioState {
  const data = effectData(state);
  if (!data?.looked?.includes(id)) return state;
  return patchTop(state, { data: { ...data, looked: data.looked.filter((entry) => entry !== id) } });
}

// Moves an encounter card where a player card effect puts it. `seat` is the player it is engaged with for `engaged`.
export function moveEncounter(
  state: ScenarioState,
  id: string,
  to: EncounterDestination,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const card = state.cards[id];
  if (!card) return state;
  const wasInPlay = inPlay(card.zone);
  const next = forgetLooked(state, id);
  switch (to) {
    case "deckTop":
    case "deckBottom":
      return toDeck(leavePlay(next, id, ctx, steps), id, to === "deckTop");
    case "shuffle":
      // The card leaves its seat's engaged list while it is still the seat's (moveCard reads its controller), then it has none (143049:A:2: an engaged enemy shuffles itself back in).
      return updateCard(shuffleIntoEncounterDeck(leavePlay(next, id, ctx, steps), id), id, { controller: null });
    case "discard":
      return updateCard(moveCard(leavePlay(next, id, ctx, steps), id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
    case "victory":
      return updateCard(moveCard(leavePlay(next, id, ctx, steps), id, { zone: "victory" }), id, { face: "up", controller: null });
    // Removed from the game: it goes to no pile ("If Mendor leaves play, remove him from the game", 01135:A:4).
    case "removed":
      return moveCard(leavePlay(next, id, ctx, steps), id, { zone: "removed" });
    case "staging": {
      // A treachery card taken from the encounter discard pile stays there: it is not added to the staging area, and a ResolveWhenRevealed after it resolves its When Revealed effects ("move the top card of the encounter discard pile to the staging area. Resolve any 'when revealed' effects on that card", 02086:A:1).
      if (card.zone === "encounterDiscard" && typeOf(next, id, ctx) === "treachery") return next;
      const staged = updateCard(moveCard(next, id, stagingDest(next, seat)), id, { face: "up", controller: null });
      if (wasInPlay) return staged;
      // Put into the staging area from out of play: it is added to the staging area and enters play.
      return announceEntered(addedToStaging(queueEvent(staged, { trigger: "addedToStaging", seat, cardId: id }), id, ctx), id, seat, ctx);
    }
    case "engaged": {
      if (typeOf(next, id, ctx) !== "enemy") return next;
      const engaged = updateCard(engageWith(next, seat, id, steps), id, { face: "up" });
      return wasInPlay ? engaged : announceEntered(engaged, id, seat, ctx);
    }
    case "activeLocation": {
      if (!isLocationId(next, id, ctx.cards)) return next;
      // In a free active location slot, else in place of the last one (families/south/locations.ts).
      const placed = updateCard(makeActiveIn(next, id), id, { face: "up", controller: null });
      const active = queueEvent(placed, { trigger: "becameActive", seat: null, cardId: id });
      return wasInPlay ? active : announceEntered(active, id, seat, ctx);
    }
  }
}

// The players travel to the location without resolving its Travel effect. An active location returns to the staging area.
export function travelThere(state: ScenarioState, id: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || !isLocationId(state, id, ctx.cards) || !inPlay(card.zone) || state.activeLocation === id || travelBlocked(state, ctx, id)) return state;
  const previous = freeSlot(state) ? null : (state.secondActiveLocation ?? state.activeLocation);
  let next = previous ? updateCard(moveCard(state, previous, { zone: "staging" }), previous, { controller: null }) : state;
  if (next.cards[id]?.zone !== "staging") next = moveCard(next, id, { zone: "staging" });
  return travelNow(next, id, ctx, steps) ?? state;
}

// The encounter discard pile goes back into the encounter deck, which is shuffled; with a `name`, only the copies of that title ("all copies of Balin's Doom", 901101:A:3); with a `trait`, only the cards with that trait do ("Shuffle all Hazard cards in the encounter discard pile back into the encounter deck", 900708:A:2); with a `type`, only the cards of that printed type ("Shuffle all locations ...", 03039:A:2).
export function shuffleDiscardIn(state: ScenarioState): ScenarioState;
export function shuffleDiscardIn(state: ScenarioState, ctx: ReduceContext, trait?: string, type?: CardType, name?: string, except?: string | null): ScenarioState;
export function shuffleDiscardIn(state: ScenarioState, ctx?: ReduceContext, trait?: string, type?: CardType, name?: string, except?: string | null): ScenarioState {
  let next = state;
  // `except`: the card whose effect shuffles stays in the discard pile (an explored location whose "When ~ is explored" effect resolves while it is still in play).
  for (const id of [...state.encounterDiscard]) if (id !== except && ((trait == null || (ctx != null && hasTrait(state, id, trait, ctx))) && (type == null || (ctx != null && typeOf(state, id, ctx) === type)) && (name == null || (ctx != null && printedOf(ctx.cards, state.cards[id]?.code ?? "").name === name)))) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  return shuffleEncounterDeck(next);
}

// The encounter discard pile and the victory display both go back into the encounter deck, which is shuffled once: the locations in them (`type`), or the cards that match the other filters ("Reshuffle all locations in the discard pile and victory display back into the encounter deck", 04018:A:1).
// The cards that went back, from both, are the running effect's `returned` count (`returnedBelow`).
export function shuffleDiscardAndVictoryIn(state: ScenarioState, ctx: ReduceContext, trait?: string, type?: CardType, name?: string): ScenarioState {
  const wanted = (id: string) => (trait == null || hasTrait(state, id, trait, ctx)) && (type == null || typeOf(state, id, ctx) === type) && (name == null || printedOf(ctx.cards, state.cards[id]?.code ?? "").name === name);
  const moving = [...state.encounterDiscard, ...state.victory].filter(wanted);
  let next = state;
  for (const id of moving) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  const shuffled = shuffleEncounterDeck(next);
  const data = effectData(shuffled);
  return data ? patchTop(shuffled, { data: { ...data, returned: data.returned + moving.length } }) : shuffled;
}

// Each location in the victory display goes into the encounter deck, which is shuffled once (144066:A:1).
export function shuffleVictoryIn(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const id of [...state.victory]) if (typeOf(state, id, ctx) === "location") next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  return shuffleEncounterDeck(next);
}

// Cards come off the top of the encounter deck into its discard pile until one of `type` is among them, or the deck is empty.
// With `reshuffle`, a deck that runs out first has the discard pile shuffled back in when the discard pile holds one, and the discarding goes on (`rr.running-out-of-cards`,
// `faq.last-encounter-card`: Trapped Inside a Barrow, 148004:A:1); with none in either pile the deck is emptied and nothing is found.
// That card is the picked card ("" when none came). A list of types stops at a card of any of them.
export function discardUntil(state: ScenarioState, wanted: CardType | readonly CardType[], ctx: ReduceContext, trait?: string, reshuffle = false): ScenarioState {
  const types: readonly CardType[] = typeof wanted === "string" ? [wanted] : wanted;
  const matches = (current: ScenarioState, id: string) => {
    const kind = typeOf(current, id, ctx);
    return kind != null && types.includes(kind) && (trait == null || hasTrait(current, id, trait, ctx));
  };
  let next = state;
  for (;;) {
    const top = next.encounterDeck[0];
    if (!top) {
      if (!reshuffle || !next.encounterDiscard.some((id) => matches(next, id))) return pushPicked(next, "");
      next = shuffleDiscardIn(next);
      continue;
    }
    next = updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
    if (matches(next, top)) return pushPicked(next, top);
  }
}

// Shows the actor the top cards of the encounter deck or of their own deck. The top card is picked, and the cards shown are
// remembered for ArrangeEncounter and PickEncounter.
export function lookAtTop(state: ScenarioState, instruction: Extract<Instruction, { verb: "LookAtTop" }>, seat: number, ctx: ReduceContext, sourceId: string | null, steps: EngineStep[]): ScenarioState {
  const count = instruction.count == null ? 1 : resolveAmount(state, instruction.count, frameScope(state, seat, sourceId), ctx);
  // A player's deck: the actor's, or the last picked player's (families/deck.ts).
  const owner = instruction.deck === "picked" ? seatOf(pickedList(state).at(-1) ?? "") : seat;
  const seen = instruction.deck === "own" || instruction.deck === "picked" ? (owner == null ? [] : (state.seats[owner]?.deck ?? []).slice(0, count)) : state.encounterDeck.slice(0, count);
  // A card among the encounter deck's cards that has a Forced effect for being looked at (Ravenous Hawk, 900402:A:1) acts at once and is not one of the cards the effect goes on with.
  const acting = instruction.deck === "own" || instruction.deck === "picked" ? [] : seen.filter((id) => effectsOf(ctx, state.cards[id]?.code ?? "").some((effect) => effect.timing === "forced" && effect.trigger === "lookedAt"));
  const ids = seen.filter((id) => !acting.includes(id));
  const data = effectData(state);
  const noted = data ? patchTop(state, { data: { ...data, looked: ids, picked: [...(data.picked ?? []), ids[0] ?? ""] } }) : state;
  // Each card's frame goes on the stack above the effect, in the order of the deck: the first one found resolves first, so it is pushed last.
  const heard = [...acting].reverse().reduce((current, id) => fireForced(current, { trigger: "lookedAt", seat, cardId: id }, ctx, steps), noted);
  if (ids.length === 0) return heard;
  // "After a player looks at one or more cards in the encounter deck" (901506:A:1): the cards are shown, then the deck's look is announced.
  const looked = instruction.deck === "own" || instruction.deck === "picked" ? heard : announceLooked(heard, ctx, seat);
  return { ...looked, window: { kind: "look", seat, cardIds: ids }, activeSeat: seat, passed: [] };
}

// How many of the top cards of the encounter deck are (or, with `not`, are not) of a type: the effect's X.
export function countTop(state: ScenarioState, instruction: Extract<Instruction, { verb: "CountEncounterTop" }>, ctx: ReduceContext): ScenarioState {
  const top = state.encounterDeck.slice(0, instruction.top);
  const count = top.filter((id) => (typeOf(state, id, ctx) === instruction.type) !== (instruction.not === true)).length;
  const data = effectData(state);
  return data ? patchTop(state, { data: { ...data, x: count } }) : state;
}

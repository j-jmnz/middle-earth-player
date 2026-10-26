// Rules: rr.encounter-deck, rr.search, rr.active-location, rr.travel, rr.attachment-cards, rr.in-play-and-out-of-play,
// rr.effects (data/rules/entries.json).
//
// Encounter cards that player card effects look at and move: the top of the encounter deck, its discard pile, the staging
// area, the active location.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, refCard } from "../amounts.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { releaseAttachments } from "../keywords.ts";
import { pickedList } from "../player-verbs.ts";
import { printedOf, type CardType } from "../printed.ts";
import { engageWith } from "../quest.ts";
import { queueEvent } from "../queue.ts";
import { travelBlocked } from "../restrictions.ts";
import type { EffectData, ScenarioState } from "../state.ts";
import { inPlay, updateCard } from "../state.ts";
import { travelNow } from "../travel.ts";
import { shuffleEncounterDeck, shuffleIntoEncounterDeck } from "../verbs.ts";
import { patchTop, topFrame } from "../windows.ts";
import { moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";
import { addedToStaging, announceEntered } from "./encounter-reveal.ts";

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
function leavePlay(state: ScenarioState, id: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone)) return state;
  return updateCard(releaseAttachments(state, id, ctx.cards, steps), id, { damage: 0, progress: 0, resources: 0, exhausted: false });
}

function toDeck(state: ScenarioState, id: string, top: boolean): ScenarioState {
  const moved = updateCard(moveCard(state, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
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
      return shuffleIntoEncounterDeck(updateCard(leavePlay(next, id, ctx, steps), id, { controller: null }), id);
    case "discard":
      return updateCard(moveCard(leavePlay(next, id, ctx, steps), id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
    case "victory":
      return updateCard(moveCard(leavePlay(next, id, ctx, steps), id, { zone: "victory" }), id, { face: "up", controller: null });
    case "staging": {
      const staged = updateCard(moveCard(next, id, { zone: "staging" }), id, { face: "up", controller: null });
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
      if (typeOf(next, id, ctx) !== "location") return next;
      const previous = next.activeLocation;
      const cleared = previous && previous !== id ? updateCard(moveCard(next, previous, { zone: "staging" }), previous, { controller: null }) : next;
      const placed = updateCard(moveCard(cleared, id, { zone: "activeLocation" }), id, { face: "up", controller: null });
      const active = queueEvent(placed, { trigger: "becameActive", seat: null, cardId: id });
      return wasInPlay ? active : announceEntered(active, id, seat, ctx);
    }
  }
}

// The players travel to the location without resolving its Travel effect. An active location returns to the staging area.
export function travelThere(state: ScenarioState, id: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || typeOf(state, id, ctx) !== "location" || !inPlay(card.zone) || state.activeLocation === id || travelBlocked(state, ctx, id)) return state;
  const previous = state.activeLocation;
  let next = previous ? updateCard(moveCard(state, previous, { zone: "staging" }), previous, { controller: null }) : state;
  if (next.cards[id]?.zone !== "staging") next = moveCard(next, id, { zone: "staging" });
  return travelNow(next, id, ctx, steps) ?? state;
}

// The encounter discard pile goes back into the encounter deck, which is shuffled.
export function shuffleDiscardIn(state: ScenarioState): ScenarioState {
  let next = state;
  for (const id of [...state.encounterDiscard]) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  return shuffleEncounterDeck(next);
}

// Cards come off the top of the encounter deck into its discard pile until one of `type` is among them, or the deck is empty.
// That card is the picked card ("" when none came).
export function discardUntil(state: ScenarioState, type: CardType, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (;;) {
    const top = next.encounterDeck[0];
    if (!top) return pushPicked(next, "");
    next = updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
    if (typeOf(next, top, ctx) === type) return pushPicked(next, top);
  }
}

// Shows the actor the top cards of the encounter deck or of their own deck. The top card is picked, and the cards shown are
// remembered for ArrangeEncounter and PickEncounter.
export function lookAtTop(state: ScenarioState, instruction: Extract<Instruction, { verb: "LookAtTop" }>, seat: number): ScenarioState {
  const count = instruction.count ?? 1;
  const ids = instruction.deck === "own" ? (state.seats[seat]?.deck ?? []).slice(0, count) : state.encounterDeck.slice(0, count);
  const data = effectData(state);
  const noted = data ? patchTop(state, { data: { ...data, looked: ids, picked: [...(data.picked ?? []), ids[0] ?? ""] } }) : state;
  if (ids.length === 0) return noted;
  return { ...noted, window: { kind: "look", seat, cardIds: ids }, activeSeat: seat, passed: [] };
}

// How many of the top cards of the encounter deck are (or, with `not`, are not) of a type: the effect's X.
export function countTop(state: ScenarioState, instruction: Extract<Instruction, { verb: "CountEncounterTop" }>, ctx: ReduceContext): ScenarioState {
  const top = state.encounterDeck.slice(0, instruction.top);
  const count = top.filter((id) => (typeOf(state, id, ctx) === instruction.type) !== (instruction.not === true)).length;
  const data = effectData(state);
  return data ? patchTop(state, { data: { ...data, x: count } }) : state;
}

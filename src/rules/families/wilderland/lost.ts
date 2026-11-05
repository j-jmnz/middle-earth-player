// Rules: rr.explored, rr.attachment-cards (data/rules/entries.json); ledger lines 18075:A:1, 18075:B:1, 18075:B:2, 18075:B:3.
// Truly Lost: each player's hand lies facedown under a location of the staging area. The cards stay their player's (`owner`) and are out of play (the under zone, core/zones.ts); the location counts them (the pick field facedownUnder) and gives them back when
// it is explored.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { isLocationCard, isLocationId, printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard, playerCardsUnder } from "../../core/zones.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

/** PlaceHandUnderLocation: the actor's hand goes facedown under a location in the staging area (an Objective-Location is one) that no hand lies under yet; the actor chooses among several. An empty hand chooses nothing. */
export function placeHandUnderLocation(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const hand = state.seats[focus.seat]?.hand ?? [];
  if (hand.length === 0) return state;
  const options = state.staging.filter((id) => {
    const card = state.cards[id];
    return card != null && isLocationCard(printedOf(ctx.cards, card.code)) && playerCardsUnder(state, id).length === 0;
  });
  const chosen = focus.chosen != null && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return options.length > 1 && effectData(state) ? askTarget(state, { instruction: { verb: "PlaceHandUnderLocation" }, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options) : state;
  let next = state;
  for (const id of hand) next = updateCard(moveCard(next, id, { zone: "under", locationId: chosen }), id, { owner: next.cards[id]?.owner ?? focus.seat });
  return next;
}

/** ReturnFacedownToHands: each facedown player card under the location (the event's subject) returns to its owner's hand. */
export function returnFacedownToHands(state: ScenarioState, subject: string | null): ScenarioState {
  let next = state;
  for (const id of subject ? playerCardsUnder(state, subject) : []) {
    const owner = state.cards[id]?.owner;
    if (owner != null) next = updateCard(moveCard(next, id, { zone: "hand", seat: owner }), id, { face: "up", owner: undefined });
  }
  return next;
}

/** DiscardFacedownUnder: each facedown player card under a location goes to its owner's discard pile (the cards under a location that left play without being explored go too). */
export function discardFacedownUnder(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    // Only the hands lying under a location: a card attached facedown under another card (an Eagle under Eagles of the Misty Mountains) is not one.
    if (card.zone === "under" && card.owner != null && card.host != null && isLocationId(state, card.host, ctx.cards)) next = updateCard(moveCard(next, card.id, { zone: "discard", seat: card.owner }), card.id, { face: "up", owner: undefined });
  }
  return next;
}

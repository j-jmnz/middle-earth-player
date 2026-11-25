// Rules: rr.in-play-and-out-of-play, rr.attachment-cards, rr.ownership-and-control, rr.resources (data/rules/entries.json).
//
// What happens to cards after they leave play: one taken back to its owner's hand ("return that ally to your hand"), the
// attachments that left with a character ("return each attachment attached to that character to its owner's hand"), one
// attached facedown to another card ("attach that card facedown to Eagles of the Misty Mountains"), and a location of the same
// title discarded; and resources spent from one chosen pool.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { noteSpent } from "../costs/pay.ts";
import { anyLocked, resourcesLocked, stopLockedSpend } from "../pelargir/spending.ts";
import type { Focus } from "../index.ts";
import { namedCard } from "./refs.ts";

// A card in a discard pile goes to its owner's hand.
function toHand(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  const owner = card ? (card.owner ?? card.controller) : null;
  return card?.zone === "discard" && owner != null ? updateCard(moveCard(state, id, { zone: "hand", seat: owner }), id, { owner: undefined }) : state;
}

// TakeIntoHand: the named card (the answered event's by default) goes from a discard pile to its owner's hand.
export function takeIntoHand(state: ScenarioState, instruction: Extract<Instruction, { verb: "TakeIntoHand" }>, focus: Focus): ScenarioState {
  const id = namedCard(state, instruction.card ?? "subject", focus);
  return id ? toHand(state, id) : state;
}

// ReturnAttachments: the attachments the answered leftPlayWithAttachments event names, those still in a discard pile, go to
// their owners' hands. The event is the one the response frame under this effect offered.
export function returnAttachments(state: ScenarioState): ScenarioState {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame?.data.kind !== "responses") continue;
    let next = state;
    for (const id of frame.data.event.attachments ?? []) next = toHand(next, id);
    return next;
  }
  return state;
}

// AttachFacedown: the named card (the answered event's by default), in a discard pile, goes facedown under the source, out of
// play and with no text (rr.in-play-and-out-of-play); it keeps its owner, and goes to its owner's discard pile when the source
// leaves play (families/play/zones.ts).
export function attachFacedown(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttachFacedown" }>, focus: Focus): ScenarioState {
  const id = namedCard(state, instruction.card ?? "subject", focus);
  const card = id ? state.cards[id] : undefined;
  const host = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const owner = card ? (card.owner ?? card.controller) : null;
  // The card is in a discard pile, or is the event being played, which still lies in the hand while its effect resolves and is discarded when that is done ("place it facedown under Lonely Lands", 18024:A:2):
  // moved under the host, it is not discarded then.
  const playing = id != null && state.stack.some((frame) => frame.cardId === id && frame.data.kind === "effect" && frame.data.finish === "discardSource");
  if (!id || (card?.zone !== "discard" && !(card?.zone === "hand" && playing)) || owner == null || !host || !inPlay(host.zone)) return state;
  return updateCard(moveCard(state, id, { zone: "under", locationId: host.id }), id, { owner });
}

/** The card in the staging area, other than `subject`, with the printed title of `subject` (DiscardSameTitle), or null. */
export function sameTitleInStaging(state: ScenarioState, subject: string | null, ctx: ReduceContext): string | null {
  const name = subject ? printedOf(ctx.cards, state.cards[subject]?.code ?? "").name : null;
  return name ? (state.staging.find((id) => id !== subject && printedOf(ctx.cards, state.cards[id]?.code ?? "").name === name) ?? null) : null;
}

// DiscardSameTitle: a card in the staging area with the title of the answered event's card goes to the encounter discard
// pile (a discard, not an exploration: no victory display).
export function discardSameTitle(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const match = sameTitleInStaging(state, namedCard(state, "subject", focus), ctx);
  return match ? moveCard(state, match, { zone: "encounterDiscard" }) : state;
}

// SpendFrom: resources spent from one pool (the last picked card's by default), all of them or none.
export function spendFrom(state: ScenarioState, instruction: Extract<Instruction, { verb: "SpendFrom" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const id = namedCard(state, instruction.card ?? "picked", focus);
  const card = id ? state.cards[id] : undefined;
  // The pick that feeds the spend found no pool that can pay while a hero is locked: the effect does not go on (the pick leaves a locked pool out).
  if (!id || !card) return anyLocked(state) ? stopLockedSpend(state) : state;
  if (card.resources < instruction.amount) return state;
  if (resourcesLocked(state, id)) return stopLockedSpend(state);
  return noteSpent(updateCard(state, id, { resources: card.resources - instruction.amount }), [{ heroId: id, amount: instruction.amount }], ctx);
}

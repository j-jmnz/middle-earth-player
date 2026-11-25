// Rules: rr.cannot, rr.reveal, rr.drawing-cards (data/rules/entries.json); ledger line 07023:A:1.
// Ill Tidings: a revealed treachery that goes into the first player's hand and cannot leave it. The move is no draw, so no card hears a draw. Three places keep it there: core/zones.ts moveCard refuses a move out of the hand while `heldInHand`, and the picks that
// discard from a hand and the random discard leave the card out (families/wilderland/pick.ts barredFromPlayerDiscard asks here).
import type { Instruction } from "../../../catalog/boundary.ts";

import { addModifier } from "../../core/modified-stat.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

/** Whether the card lies in the hand of a living player and holds `cannotLeaveHand`. A seat that is eliminated keeps nothing in its hand (rr.player-elimination). False in every game without the flag. */
export function heldInHand(state: ScenarioState, id: string): boolean {
  if (state.modifiers.length === 0) return false;
  const card = state.cards[id];
  if (!card || card.zone !== "hand" || !flagged(state, id, "cannotLeaveHand")) return false;
  return card.controller == null || !state.seats[card.controller]?.eliminated;
}

/** DrawSelfIntoHand: the source goes into the hand of the acting seat and holds `cannotLeaveHand` from then on. A source that is no longer in the staging area (canceled and discarded) goes nowhere. */
export function drawSelfIntoHand(state: ScenarioState, _instruction: Extract<Instruction, { verb: "DrawSelfIntoHand" }>, focus: Focus): ScenarioState {
  const id = focus.sourceId;
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.zone !== "staging" || state.seats[focus.seat]?.eliminated) return state;
  return addModifier(moveCard(state, id, { zone: "hand", seat: focus.seat }), id, id, "cannotLeaveHand", 1, "endOfGame");
}

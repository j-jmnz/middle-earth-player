// Rules: rr.triggered-ability, rr.cost, rr.then (data/rules/entries.json).
// The idle checks of the costs family's verbs (src/rules/player/potential.ts, Whether an ability could change the game): a cost discount of 0, a play from the hand
// with no card to play, and a move of resources that no hero can take.
import type { IdleHook } from "../../interpret/family-manifest.ts";
import { amountIdle, seatsOfWho } from "../../player/idle-reads.ts";
import { mayGainResources } from "../misc/guards.ts";
import { spentThisRound } from "./pay.ts";
import { playOptions } from "./play.ts";

export const costsIdle: IdleHook = (state, instruction, sourceId, frame, ctx) => {
  if (instruction.verb === "ReduceNextCost") return amountIdle(state, instruction.amount, frame, ctx);
  // "Play an Item attachment from your hand" with no card in the hand that can be played changes nothing (rr.triggered-ability).
  if (instruction.verb === "PlayFromHand") return instruction.picked ? null : playOptions(state, instruction, frame.seat, sourceId, ctx).length === 0;
  if (instruction.verb !== "HeroesGainResources") return null;
  // Each hero of the seat that may gain (with `unspent`, one that spent nothing this round): with none, the move adds nothing (rr.then).
  const seats = seatsOfWho(state, instruction.who, frame);
  if (seats == null) return false;
  if (amountIdle(state, instruction.amount, frame, ctx)) return true;
  return seats.every((index) => (state.seats[index]?.heroes ?? []).every((id) => (instruction.unspent === true && spentThisRound(state, id)) || !mayGainResources(state, id, sourceId, ctx)));
};

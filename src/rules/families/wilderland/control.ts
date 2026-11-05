// Rules: rr.guarded, rr.ownership-and-control (data/rules/entries.json); ledger line 18070:A:1. "The first player gains control of Haldan while he is free of encounters": a guarded objective in the staging area that the first player gains control of
// when its guard is gone enters their play area. The constant verb GainControlWhenFree marks the card; the settle sweep moves it. Pure.
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { freeOfEncounters } from "../objectives/free.ts";

/** Each card in the staging area with the marker that is free of encounters enters the first player's play area, faceup, controlled by them; the families hear `changedControl`. */
export function controlFreedObjectives(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure) return state;
  const codes = constantVerbCodes(ctx, "GainControlWhenFree");
  if (codes.size === 0 || state.seats[state.firstPlayer]?.eliminated) return state;
  let next = state;
  for (const id of state.staging) {
    const card = next.cards[id];
    if (!card || card.zone !== "staging" || !codes.has(card.code) || !freeOfEncounters(next, id)) continue;
    next = queueEvent(updateCard(moveCard(next, id, { zone: "play", seat: state.firstPlayer }), id, { face: "up" }), { trigger: "changedControl", seat: state.firstPlayer, cardId: id });
  }
  return next;
}

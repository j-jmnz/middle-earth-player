// Rules: rr.guarded, rr.ownership-and-control, rr.objective-cards (data/rules/entries.json); ledger lines 12134:A:2, 12135:A:2, 12136:A:2, 12137:A:2.
//
// "If ~ is free of encounters, add it to the staging area, controlled by the players": a tower of Cobas Haven whose guard is gone stays in the staging area, and the players control it. The
// constant verb ControlWhenFree marks it `claimed` (the marker of an objective a player holds: the table folds it first in the staging area, a discard returns it to the staging area) with
// no controller, so it belongs to the players as a group and any player may use its Actions (rr.action). The sweep waits for an empty stack: a tower just revealed is free for a moment
// before its Guarded keyword attaches the next card of the encounter deck.
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { freeOfEncounters } from "./free.ts";

// The players control an objective they claimed (attached to a hero) or a freed tower in the staging area.
export function controlledByPlayers(state: ScenarioState, sourceId: string | null): boolean {
  return sourceId != null && state.cards[sourceId]?.claimed === true;
}

// Every such objective in the staging area that is free of encounters and not yet controlled becomes the players'.
export function controlSweep(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure) return state;
  const codes = constantVerbCodes(ctx, "ControlWhenFree");
  if (codes.size === 0) return state;
  let next = state;
  for (const id of state.staging) {
    const card = next.cards[id];
    if (!card || card.zone !== "staging" || card.claimed === true || !codes.has(card.code) || !freeOfEncounters(next, card.id)) continue;
    next = updateCard(next, card.id, { claimed: true, controller: null });
  }
  return next;
}

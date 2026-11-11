// Rules: mec112.mire (data/rules/entries.json); ledger lines 144019:A:1, 144016:A:2, 144024:A:2. The Mire X keyword of The Passage of the Marshes: the verb that places a mire token, the placement at the end of the
// refresh phase (mireAtRefreshEnd, called where the refresh phase ends: windows/triggers.ts crossBoundary) and the discard when the tokens reach X. A mire token is a resource on the location.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount, inPlay } from "../../core/state.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import { queueEvent } from "../../windows/queue.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { addResourceTokens } from "../nightmare/dungeon.ts";
import type { Focus } from "../index.ts";

/** The Mire X of a card in play (the flag `mire` a location's record holds), null for a card without the keyword. */
export function mireOf(state: ScenarioState, id: string): number | null {
  const value = heldAmount(state, id, "mire");
  return value > 0 ? value : null;
}

/** The mire tokens on a location against its Mire X, for the table's chip and the preview. Null for a card without the keyword. */
export function mireTally(state: ScenarioState, id: string): { value: number; tokens: number } | null {
  const value = mireOf(state, id);
  const card = state.cards[id];
  return value == null || !card ? null : { value, tokens: card.resources };
}

/** `count` mire tokens on the card, then the Mire check: a location in play whose tokens reach its Mire X is discarded by the Mire keyword (mec112.mire). */
export function placeMire(state: ScenarioState, id: string | null | undefined, count: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || !inPlay(card.zone)) return state;
  return discardIfMired(addResourceTokens(state, id, count), id, ctx, steps);
}

// A location whose tokens equal or pass its Mire X is discarded at once to the encounter discard pile, and its own Forced effect hears why (the event is about the card and heard from the discard pile).
function discardIfMired(state: ScenarioState, id: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  const value = mireOf(state, id);
  if (!card || value == null || card.resources < value || !inPlay(card.zone)) return state;
  const discarded = moveEncounter(state, id, "discard", state.firstPlayer, ctx, steps);
  return queueEvent(discarded, { trigger: "discardedByMire", seat: null, subject: id });
}

/** "At the end of the refresh phase, place 1 resource on each location in the staging area with the mire keyword" (mec112.mire): one token each, a location discarded as it reaches its X before the next is placed. */
export function mireAtRefreshEnd(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of state.staging) if (mireOf(next, id) != null) next = placeMire(next, id, 1, ctx, steps);
  return next;
}

/** ReturnRandomVictoryLocation: a location of the victory display, chosen with the seed, joins the staging area (144020:A:2). */
export function returnRandomVictory(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const locations = state.victory.filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "location");
  if (locations.length === 0) return state;
  const shuffled = shuffleIds(locations, state.seed, state.seedCursor);
  const chosen = shuffled.ids[0];
  return chosen ? moveEncounter({ ...state, seedCursor: shuffled.cursor }, chosen, "staging", focus.seat, ctx, steps) : state;
}

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PlaceMireToken": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      return placeMire(state, refCard(state, instruction.on, scope), resolveAmount(state, instruction.amount, scope, ctx), ctx, steps);
    }
    case "ReturnRandomVictoryLocation":
      return returnRandomVictory(state, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "mire", verbs: ["PlaceMireToken", "ReturnRandomVictoryLocation"], run };

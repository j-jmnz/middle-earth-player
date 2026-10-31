// Rules: dcce.corsair-deck, dcce.boarding (data/rules/entries.json). The Corsair deck is a separate deck of non-ship enemies with its own discard
// pile. "Prepare the Corsair deck" takes every non-ship enemy out of the encounter deck, shuffles them into a deck of their own, and from then on a
// non-ship enemy that would be discarded goes to the Corsair discard pile (the route sea-routes.ts gives it). The Corsair deck runs out, and its
// discard pile is shuffled back into it at once. Its enemies are revealed only by card abilities, such as the Boarding keyword.
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import { shuffleIds } from "../seed.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { shuffleEncounterDeck } from "../verbs.ts";
import { moveCard } from "../zones.ts";
import { moveEncounter } from "./encounter-moves.ts";

/** The Corsair deck has been prepared in this game: its zones exist. */
export function hasCorsairDeck(state: Pick<ScenarioState, "corsairDeck">): boolean {
  return state.corsairDeck !== undefined;
}

// The Corsair deck shuffled with the game's seed.
function shuffledDeck(state: ScenarioState): ScenarioState {
  const shuffled = shuffleIds(state.corsairDeck ?? [], state.seed, state.seedCursor);
  return { ...state, corsairDeck: shuffled.ids, seedCursor: shuffled.cursor };
}

/** "Prepare the Corsair deck" (dcce.corsair-deck): the non-ship enemies of the encounter deck join those already dealt to the Corsair deck, the deck
 * is shuffled, and the Corsair discard pile exists, empty. */
export function prepareCorsairDeck(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  let next: ScenarioState = { ...state, corsairDeck: state.corsairDeck ?? [], corsairDiscard: state.corsairDiscard ?? [] };
  for (const id of [...next.encounterDeck]) {
    const instance = next.cards[id];
    const printed = instance ? printedOf(ctx.cards, instance.code) : undefined;
    if (printed?.type !== "enemy" || printed.ship != null) continue;
    next = moveCard(next, id, { zone: "corsairDeck" });
  }
  return shuffledDeck(next);
}

/** The Corsair deck ran out: its discard pile is shuffled back into it (dcce.corsair-deck). Settle keeps every game's deck refilled. */
export function refillCorsairDeck(state: ScenarioState): ScenarioState {
  if (state.corsairDeck === undefined || state.corsairDeck.length > 0 || (state.corsairDiscard ?? []).length === 0) return state;
  let next = state;
  for (const id of [...(state.corsairDiscard ?? [])]) next = updateCard(moveCard(next, id, { zone: "corsairDeck" }), id, { face: "down" });
  return shuffledDeck(next);
}

/** Reveals the top card of the Corsair deck and puts it into play engaged with the seat (dcce.boarding): an enemy entering play, so the engine
 * announces it as every encounter card that enters play is. Null when the deck and its discard pile are both empty. */
export function revealOne(state: ScenarioState, seat: number, ctx: ReduceContext, steps: EngineStep[]): { state: ScenarioState; id: string | null } {
  const filled = refillCorsairDeck(state);
  const top = filled.corsairDeck?.[0];
  if (!top) return { state: filled, id: null };
  return { state: moveEncounter(filled, top, "engaged", seat, ctx, steps), id: top };
}

/** Reveals `count` cards, one after the other (the deck refills between them), each into play engaged with the seat. */
export function revealCorsair(state: ScenarioState, seat: number, count: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (let revealed = 0; revealed < count; revealed += 1) {
    const one = revealOne(next, seat, ctx, steps);
    next = one.state;
    if (one.id == null) break;
  }
  return next;
}

/** "End the Corsair deck" (dcce.from-sea-to-land, stage 2B of The City of Corsairs): the Corsair deck and its discard pile are shuffled into the
 * encounter deck the players are using, and the Corsair deck is gone: a non-ship enemy is discarded to the encounter discard pile again, and none is
 * revealed by Boarding. In a game with no Corsair deck nothing changes. */
export function endCorsairDeck(state: ScenarioState): ScenarioState {
  if (state.corsairDeck === undefined) return state;
  let next = state;
  for (const id of [...(state.corsairDeck ?? []), ...(state.corsairDiscard ?? [])]) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down" });
  const { corsairDeck: _deck, corsairDiscard: _discard, ...rest } = next;
  return shuffleEncounterDeck(rest);
}

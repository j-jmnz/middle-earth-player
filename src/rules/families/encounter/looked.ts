// Rules: rr.encounter-deck, rr.search, rr.forced (data/rules/entries.json); ledger line 901506:A:1.
//
// "After a player looks at one or more cards in the encounter deck": a look at its top cards (LookAtTop) or a search of it (SearchMove, SearchReveal, PickEncounter) announces `lookedAtEncounterDeck` for the seat, once the cards are shown. Any card in play hears it.
// Queued only in a game with a card that hears it, so no other game's events change.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";

export function announceLooked(state: ScenarioState, ctx: ReduceContext, seat: number): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"lookedAtEncounterDeck"')) return state;
  return queueEvent(state, { trigger: "lookedAtEncounterDeck", seat });
}

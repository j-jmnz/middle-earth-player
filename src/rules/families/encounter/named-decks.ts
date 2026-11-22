// Rules: dcce.boarding, emce.evil-creatures-deck (data/rules/entries.json). Revealing the top card of a separate encounter deck with a discard pile of its own (core/piles.ts DECKS): the Corsair deck (families/sea/corsair.ts)
// and the Evil Creatures deck (families/wilderland/decks.ts) share it.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { refillDeck } from "../../core/decks.ts";
import { type DeckZones, topOf } from "../../core/piles.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveEncounter } from "./moves.ts";

/** Reveals the top card of the deck and puts it into play (`to`: engaged with the seat, or in the staging area); an announced entry, as every encounter card that enters play. The deck refills from its discard
 * pile first. Null when the deck and its discard pile are both empty. */
export function revealTop(state: ScenarioState, zones: DeckZones, to: "engaged" | "staging", seat: number, ctx: ReduceContext, steps: EngineStep[]): { state: ScenarioState; id: string | null } {
  const filled = refillDeck(state, zones, steps);
  const top = topOf(filled, zones.deck);
  if (!top) return { state: filled, id: null };
  return { state: moveEncounter(filled, top, to, seat, ctx, steps), id: top };
}

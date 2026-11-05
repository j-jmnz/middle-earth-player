// Rules: emce.loot (data/rules/entries.json). "If a card with the loot keyword is revealed from the encounter deck, discard it and reveal another card from the top of the encounter deck." startReveal (windows/frames.ts) asks
// for the card to reveal; the Loot cards on top of the deck are discarded first.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { resetEncounterDeck } from "../../interpret/verbs.ts";
import { moveCard } from "../../core/zones.ts";
import { markedCodes } from "./markers.ts";

/** The encounter deck with every Loot card on top of it discarded, the deck refilled from its discard pile when that empties it (a Loot card is not shuffled back in for good: the search stops after one pass over the cards). */
export function skipLoot(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const loot = markedCodes(ctx, "Loot");
  if (loot.size === 0) return state;
  let next = state;
  for (let passes = state.encounterDeck.length + state.encounterDiscard.length; passes > 0; passes -= 1) {
    const top = next.encounterDeck[0];
    if (top === undefined || !loot.has(next.cards[top]?.code ?? "")) return next;
    next = resetEncounterDeck(updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null }), steps);
  }
  return next;
}

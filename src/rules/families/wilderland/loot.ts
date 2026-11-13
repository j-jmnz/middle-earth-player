// Rules: emce.loot (data/rules/entries.json). "If a card with the loot keyword is revealed from the encounter deck, discard it and reveal another card from the top of the encounter deck." startReveal (windows/frames.ts) asks
// for the card to reveal; the Loot cards on top of the deck are discarded first.
import type { EngineStep } from "../../core/intents.ts";
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { resetEncounterDeck } from "../../interpret/verbs.ts";
import { moveCard } from "../../core/zones.ts";

/**
 * The encounter deck with every Loot card on top of it discarded, the deck refilled from its discard pile when that empties it, and the card to reveal (undefined when there is none). The search stops after one pass over the cards: when the
 * passes run out with a Loot card still on top, nothing is revealed, as a Loot card can only enter play by resolving the discover keyword (emce.loot).
 */
export function skipLoot(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): { state: ScenarioState; top: string | undefined } {
  const loot = constantVerbCodes(ctx, "Loot");
  if (loot.size === 0) return { state, top: state.encounterDeck[0] };
  const isLoot = (next: ScenarioState, id: string) => loot.has(next.cards[id]?.code ?? "");
  let next = state;
  for (let passes = state.encounterDeck.length + state.encounterDiscard.length; passes > 0; passes -= 1) {
    const top = next.encounterDeck[0];
    if (top === undefined || !isLoot(next, top)) return { state: next, top };
    next = resetEncounterDeck(updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null }), steps, ctx);
  }
  const last = next.encounterDeck[0];
  return { state: next, top: last !== undefined && isLoot(next, last) ? undefined : last };
}

// Rules: wor.guarded-x, emce.guarded-x (data/rules/entries.json). "Discard cards from the encounter deck until an encounter card with the matching type is discarded": the search a Guarded (X) keyword makes, for a player attachment
// (attachments/play.ts) and for an objective (objectives/index.ts). If the encounter deck is empty while it goes on, the encounter discard pile is shuffled into it and the search finishes.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { shuffleDiscardIn } from "./moves.ts";

/** The first card of one of `types` discarded from the top of the encounter deck, and the state after the discards; null with no card of those types in the deck or its discard pile (nothing is discarded then). */
export function discardUntilType(state: ScenarioState, types: readonly string[], ctx: ReduceContext): { state: ScenarioState; found: string | null } {
  const wanted = (id: string) => types.includes(printedOf(ctx.cards, state.cards[id]?.code ?? "").type);
  if (![...state.encounterDeck, ...state.encounterDiscard].some(wanted)) return { state, found: null };
  let current = state;
  for (;;) {
    const top = current.encounterDeck[0];
    if (!top) {
      current = shuffleDiscardIn(current);
      continue;
    }
    current = updateCard(moveCard(current, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
    if (wanted(top)) return { state: current, found: top };
  }
}

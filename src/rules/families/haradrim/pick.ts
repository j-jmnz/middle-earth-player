// Rules: rr.ownership-and-control, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger line 17022:A:1.
// The haradrim family's pick filter: a card that shares its title with a card the running effect discarded from the actor's own deck (`sameTitleAsDiscarded`, The Savage South).
import type { PickSpec } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { PickContext } from "../../interpret/pick.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectData } from "../deck/moves.ts";

/** False when the pick asks for `sameTitleAsDiscarded` and the card shares no title with a card the effect discarded from the chooser's deck; true leaves the other filters to decide. */
export function haradrimPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext): boolean {
  if (!spec.sameTitleAsDiscarded) return true;
  const card = state.cards[id];
  if (!card) return false;
  const title = printedOf(ctx.cards, card.code).name;
  return (effectData(state)?.discardedFromDecks ?? []).some((discarded) => (state.cards[discarded]?.owner ?? state.cards[discarded]?.controller) === at.seat && printedOf(ctx.cards, state.cards[discarded]?.code ?? "").name === title);
}

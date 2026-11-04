// Rules: rr.cancel, rr.effects (data/rules/entries.json); ledger line 41010:A:1.
//
// "While The Eaves of Mirkwood is the active location, encounter card effects cannot be canceled." The table holds the flag
// `encounterUncancelable` while it is: no cancel Response is offered against a When Revealed or Shadow effect (A Test of Will, Hasty Stroke), while a Response that does not cancel is, and the
// paid cancel an encounter card's own Forced effect offers (141077:A:2) is not offered either.
import type { Effect } from "../../../catalog/boundary.ts";
import type { GameEvent, ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

export function encounterUncancelable(state: ScenarioState): boolean {
  return flagged(state, "table", "encounterUncancelable");
}

// Whether an offer in this window is barred: a Response that cancels the effect of an encounter card about to resolve (CancelEffect) is not
// offered in the When Revealed or Shadow window. The window itself stays: a Response that only reacts (Round Shield's Defense) is still offered.
export function cancelBarred(state: ScenarioState, event: GameEvent, effect: Effect): boolean {
  return (event.trigger === "whenRevealedPending" || event.trigger === "shadowPending") && encounterUncancelable(state) && effect.instructions.some((instruction) => instruction.verb === "CancelEffect");
}

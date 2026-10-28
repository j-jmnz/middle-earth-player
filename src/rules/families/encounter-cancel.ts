// Rules: rr.cancel, rr.effects (data/rules/entries.json); ledger line 41010:A:1.
//
// "While The Eaves of Mirkwood is the active location, encounter card effects cannot be canceled." The table holds the flag
// `encounterUncancelable` while it is: no Response is offered against a When Revealed or Shadow effect (A Test of Will, Hasty Stroke), and the
// paid cancel an encounter card's own Forced effect offers (141077:A:2) is not offered either.
import type { GameEvent, ScenarioState } from "../state.ts";
import { flagged } from "../state.ts";

export function encounterUncancelable(state: ScenarioState): boolean {
  return flagged(state, "table", "encounterUncancelable");
}

// The windows in which a Response cancels the effect of an encounter card that is about to resolve.
export function cancelWindowBarred(state: ScenarioState, event: GameEvent): boolean {
  return (event.trigger === "whenRevealedPending" || event.trigger === "shadowPending") && encounterUncancelable(state);
}

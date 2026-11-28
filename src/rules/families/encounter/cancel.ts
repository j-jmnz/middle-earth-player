// Rules: rr.cancel, rr.effects (data/rules/entries.json); ledger line 41010:A:1.
//
// "While The Eaves of Mirkwood is the active location, encounter card effects cannot be canceled." The table holds the flag
// `encounterUncancelable` while it is: no cancel Response is offered against a When Revealed or Shadow effect (A Test of Will, Hasty Stroke) or the whole revealed card (The Master Ring), while a Response that does not cancel is, and the
// paid cancel an encounter card's own Forced effect offers (141077:A:2) is not offered either.
import type { Effect } from "../../../catalog/boundary.ts";
import type { GameEvent, ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

export function encounterUncancelable(state: ScenarioState): boolean {
  return flagged(state, "table", "encounterUncancelable");
}

// The card whose When Revealed effects an offer would cancel: the event is a reveal and the effect holds a CancelEffect (rr.cancel). Undefined for any other offer.
export function cancelsReveal(state: ScenarioState, event: GameEvent, effect: Effect): string | undefined {
  if (event.trigger !== "encounterRevealed" && event.trigger !== "whenRevealedPending") return undefined;
  if (!effect.instructions.some((instruction) => instruction.verb === "CancelEffect")) return undefined;
  const subject = event.subject ?? event.cardId;
  return subject && state.cards[subject] ? subject : undefined;
}

// Whether an offer in this window is barred: a Response that cancels the effect of an encounter card about to resolve (CancelEffect) is not
// offered in the When Revealed or Shadow window. The window itself stays: a Response that only reacts (Round Shield's Defense) is still offered.
export function cancelBarred(state: ScenarioState, event: GameEvent, effect: Effect): boolean {
  const cancels = effect.instructions.some((instruction) => instruction.verb === "CancelEffect");
  // The Beast of Taur-nu-Fuin's own shadow cards cannot be canceled (50916:A:1): the enemy of the attack in progress holds the flag.
  if (event.trigger === "shadowPending" && cancels && flagged(state, state.pendingAttack?.enemyId ?? "", "shadowsUncancelable")) return true;
  // While Chieftain of the Pit is in play no shadow effect can be canceled, whoever's enemy it is on (51348:A:2).
  if (event.trigger === "shadowPending" && cancels && flagged(state, "table", "allShadowsUncancelable")) return true;
  // The card SearchTopReveal revealed (51003:A:1): its When Revealed effects cannot be canceled.
  if (event.trigger === "whenRevealedPending" && cancels && flagged(state, event.subject ?? event.cardId ?? "", "revealUncancelable")) return true;
  // "Encounter card effects cannot be canceled" bars the cancel of the whole card too (faq.cancel-encounter-card, the Master Ring's Response to the reveal; Captured Tower, 22018:A:1).
  return (event.trigger === "whenRevealedPending" || event.trigger === "shadowPending" || event.trigger === "encounterRevealed") && encounterUncancelable(state) && cancels;
}

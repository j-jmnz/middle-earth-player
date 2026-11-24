// Rules: rr.cannot, rr.resources (data/rules/entries.json); ledger line 05058:A:1.
// Orc Vanguard in the staging area: no resource can be spent from the pool of a hero with a Leadership, Spirit or Lore icon. Resources can still be gained and moved, and discarded (a discard is not spending). A constant on the hero sets `cannotSpendResources`; every spender reads it:
// costs/pay.ts payerOk, costs/verbs.ts spendablePools and SpendResources from one pool, encounter/items.ts PayResources, play/leave.ts SpendFrom, defense/index.ts SpendFromPool.
import { flagged, type ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

/** Whether resources cannot be spent from this card's pool. */
export function resourcesLocked(state: ScenarioState, id: string): boolean {
  return state.modifiers.length > 0 && flagged(state, id, "cannotSpendResources");
}

/** A spend a lock stops: nothing is paid, and what the payment was for does not resolve, so the rest of the effect's steps are dropped (Elfhelm's play, Livery of the Tower's cancel). */
export function stopLockedSpend(state: ScenarioState): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? patchTop(state, { data: { ...data, queue: [] } }) : state;
}

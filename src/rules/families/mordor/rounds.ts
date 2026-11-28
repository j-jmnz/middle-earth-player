// Rules: rr.damage, rr.lasting-effects, rr.threat-threat-dial (data/rules/entries.json); ledger lines 21042:A:2, 21048:A:2.
// What the families note for a round: the enemies engaged with a seat that cannot take damage until the end of the round (Overwhelmed) and the seats that raised their threat this round (Darkness in the East).
import type { Condition } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import { flagged, modifierActive } from "../../core/state.ts";
import type { Scope } from "../../interpret/conditions.ts";
import type { Focus } from "../index.ts";

/** BarDamageToEngaged: the enemies engaged with the first player now, and any that engage him before the end of the round, cannot take damage (the holder is the seat, like the note of a raised threat, not the enemies). */
export function barDamageToEngaged(state: ScenarioState, focus: Focus): ScenarioState {
  return { ...state, modifiers: [...state.modifiers, { instanceId: `seat:${state.firstPlayer}`, sourceId: focus.sourceId ?? "table", stat: "noDamageToEngaged", amount: 1, until: "endOfRound" }] };
}

/** Whether a lasting effect bars damage to the enemy: it is engaged with the seat a BarDamageToEngaged named. Read by the damage rules; false with no such effect. */
export function mordorDamageBarred(state: ScenarioState, id: string): boolean {
  if (state.modifiers.length === 0) return false;
  const card = state.cards[id];
  if (!card || card.zone !== "engaged") return false;
  return state.modifiers.some((modifier) => modifier.stat === "noDamageToEngaged" && modifier.instanceId === `seat:${card.controller}` && modifierActive(state, modifier));
}

/** A seat raised its threat: with the table flag `noteThreatRaised` the seat holds `raisedThreat` until the end of the round. Every other game has no flag, so its state never changes. */
export function noteThreatRaised(state: ScenarioState, seat: number): ScenarioState {
  if (state.modifiers.length === 0 || !flagged(state, "table", "noteThreatRaised") || flagged(state, `seat:${seat}`, "raisedThreat")) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: `seat:${seat}`, sourceId: "table", stat: "raisedThreat", amount: 1, until: "endOfRound" }] };
}

/** The condition `raisedThreatThisRound`: the acting seat raised its threat this round. Null for any other condition. */
export function mordorCondition(state: ScenarioState, condition: Condition, scope: Scope): boolean | null {
  return condition.kind === "raisedThreatThisRound" ? flagged(state, `seat:${scope.actor}`, "raisedThreat") : null;
}

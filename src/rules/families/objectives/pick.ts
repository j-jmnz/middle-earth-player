// Rules: rr.guarded (data/rules/entries.json); ledger lines 12121:A:1, 12133:A:1. The objectives family's filters: an objective with or without an encounter card attached to it, an enemy that is or
// is not attached to an objective as its guard.
import type { PickSpec } from "../../../catalog/boundary.ts";

import { inPlay } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { freeOfEncounters } from "./free.ts";

// An encounter card attached to an objective in play as its guard (the guard marker is set as it attaches and cleared as it leaves).
export function isGuard(state: ScenarioState, id: string): boolean {
  const card = state.cards[id];
  const host = card?.host ? state.cards[card.host] : undefined;
  return card?.guard === true && host != null && inPlay(host.zone);
}

export function objectivesPickMatches(state: ScenarioState, id: string, spec: PickSpec): boolean {
  if (spec.hasGuard != null && !freeOfEncounters(state, id) !== spec.hasGuard) return false;
  if (spec.isGuard != null && isGuard(state, id) !== spec.isGuard) return false;
  return true;
}

// Rules: dcce.grapple (data/rules/entries.json); ledger lines 12051:A:1, 12055:A:2, 12041:B:2, 12042:A:2. What the grapple family reads: the enemies grappled with each location, the Threat they add to it,
// and the numbers a record asks for ("the number of enemies grappled with locations in the staging area", "each resource token on a Raider enemy", "the total Threat of any one Ship location").
import type { Condition, PickSpec } from "../../catalog/boundary.ts";

import type { AmountScope } from "../amounts.ts";
import { pickCandidates } from "../pick.ts";
import { printedOf } from "../printed.ts";
import type { ReduceContext } from "../interpret.ts";
import { shownSide } from "./dreamchaser-faces.ts";
import type { ScenarioState } from "../state.ts";
import { modifiedStat } from "../keywords.ts";

/** The Threat a grappled enemy adds to the location it is grappled with (dcce.grapple: "it adds 2 Threat to the Threat of the location"). */
export const GRAPPLE_THREAT = 2;

const GRAPPLED: WeakMap<ScenarioState, ReadonlyMap<string, readonly string[]>> = new WeakMap();

// The grappled enemies by the location they are grappled with, in instance order. A state is never changed once the reducer returns it, so the index is kept for as long as the state lives.
function indexOf(state: ScenarioState): ReadonlyMap<string, readonly string[]> {
  const known = GRAPPLED.get(state);
  if (known) return known;
  const found = new Map<string, string[]>();
  for (const card of Object.values(state.cards)) {
    if (card.zone !== "grappled" || card.host == null) continue;
    found.set(card.host, [...(found.get(card.host) ?? []), card.id]);
  }
  GRAPPLED.set(state, found);
  return found;
}

/** The enemies grappled with the location. */
export function grappledWith(state: ScenarioState, locationId: string): readonly string[] {
  return indexOf(state).get(locationId) ?? [];
}

/** The Threat the location's grappled enemies add to it (2 each). */
export function grappleThreat(state: ScenarioState, locationId: string): number {
  return grappledWith(state, locationId).length * GRAPPLE_THREAT;
}

/** Every enemy grappled with a location in the staging area (`grappled` amount). */
export function grappledCount(state: ScenarioState): number {
  let count = 0;
  for (const arms of indexOf(state).values()) count += arms.length;
  return count;
}

/** The `locationThreat` condition: a location in play with the trait has a total Threat (the grappled enemies' included) of at least `min`. */
export function locationThreatHolds(state: ScenarioState, condition: Extract<Condition, { kind: "locationThreat" }>, ctx: ReduceContext): boolean {
  return Object.values(state.cards).some((card) => {
    if (card.zone !== "staging" && card.zone !== "activeLocation" && card.zone !== "secondActiveLocation") return false;
    const printed = printedOf(ctx.cards, card.code);
    return printed.type === "location" && printed.traits.includes(condition.trait) && modifiedStat(state, card, "threat", ctx.cards) >= condition.min;
  });
}

/** The `resourcesOn` amount: the resource tokens on the cards that match, added up. */
export function resourcesOnMatching(state: ScenarioState, pick: PickSpec, scope: AmountScope, ctx: ReduceContext): number {
  return pickCandidates(state, pick, scope.actor, [], scope.sourceId, ctx, undefined, undefined, true).reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0);
}

/** The `side` Pick filter: the card shows that side. */
export function sidePickMatches(state: ScenarioState, id: string, spec: PickSpec): boolean {
  const card = state.cards[id];
  return spec.side == null || (card != null && shownSide(card) === spec.side);
}

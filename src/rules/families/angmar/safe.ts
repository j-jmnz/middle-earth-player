// Rules: mec108.safe, mec108.objective-locations, rr.keywords (data/rules/entries.json); ledger lines 10068:A:1, 10069:A:1, 10070:A:1, 10071:A:1, 10065:B:1, 10066:B:1, 10075:A:2.
// The Safe keyword of Across the Ettenmoors: a constant marker verb (`Safe`) on each objective-location that prints it. This module finds the cards that have it (`isSafeLocation`), answers the condition `safeActive` (a safe location is the active location) and the pick filter `safe`,
// and says when a treachery's "when revealed" effects are ignored. What a safe location does while it is active (no engagement checks, blank encounter side quests, ignored treachery reveals) and when the players travel to it is written with ordinary records on the four cards.
import type { Condition, PickSpec } from "../../../catalog/boundary.ts";

import { constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { hitPointsOf } from "./quest.ts";

/** Whether the card is one that prints the Safe keyword (its code has a constant `Safe` record). */
export function isSafeLocation(state: ScenarioState, id: string | null | undefined, ctx: Pick<ReduceContext, "effects">): boolean {
  const code = id ? state.cards[id]?.code : undefined;
  return code != null && constantVerbCodes(ctx, "Safe").has(code);
}

/** A safe location with an encounter card attached as its guard cannot be the active location; it returns to the staging area unguarded once the guard leaves play (mec108.objective-locations, which names Across the Ettenmoors' four objective-locations). */
export function guardedSafeLocation(state: ScenarioState, ctx: Pick<ReduceContext, "effects">, id: string): boolean {
  const card = state.cards[id];
  return card != null && card.attachments.some((attached) => state.cards[attached]?.guard === true) && isSafeLocation(state, id, ctx);
}

/** Whether a location with the Safe keyword is the active location. */
export function safeActive(state: ScenarioState, ctx: Pick<ReduceContext, "effects">): boolean {
  return isSafeLocation(state, state.activeLocation, ctx);
}

/** The condition `safeActive`; null for any other condition. */
export function safeActiveHolds(state: ScenarioState, condition: Condition, ctx: ReduceContext): boolean | null {
  return condition.kind === "safeActive" ? safeActive(state, ctx) === condition.is : null;
}

/** The condition `setAsideHas`: a copy of the card with the code is set aside; null for any other condition. */
export function setAsideHasHolds(state: ScenarioState, condition: Condition): boolean | null {
  return condition.kind === "setAsideHas" ? state.setAside.some((id) => state.cards[id]?.code === condition.code) : null;
}

/** False for a card the filters `safe`, `minDamage` and `maxHitPointsLeft` rule out; true when the pick asks neither. */
export function safePickMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext): boolean {
  if (spec.safe === true && !isSafeLocation(state, id, ctx)) return false;
  if (spec.minDamage != null && (state.cards[id]?.damage ?? 0) < spec.minDamage) return false;
  const card = state.cards[id];
  return spec.maxHitPointsLeft == null || (card != null && hitPointsOf(state, card, ctx) - card.damage <= spec.maxHitPointsLeft);
}

/** Whether the card's "when revealed" effects are ignored: it is a treachery and the table holds `treacheryRevealIgnored` (a safe location is active). */
export function whenRevealedIgnored(state: ScenarioState, id: string, ctx: Pick<ReduceContext, "cards">): boolean {
  if (state.modifiers.length === 0 || !flagged(state, "table", "treacheryRevealIgnored")) return false;
  const code = state.cards[id]?.code;
  return code != null && printedOf(ctx.cards, code).type === "treachery";
}

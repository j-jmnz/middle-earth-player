// Rules: hob.burgle, rr.first-player (data/rules/entries.json); ledger lines 132042:A:3 and the other burgle lines, 132051:A:1. The Pick filters of the burgle family: the hand cards that match the revealed card (`burgleMatch`), and the hero with the most resources (`mostResources`), which keeps every card that ties, and the chooser decides among them.
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import type { PickContext } from "../../interpret/pick.ts";
import { tiedExtreme } from "../../interpret/tied-extreme.ts";
import type { ScenarioState } from "../../core/state.ts";
import { burgleEffectOf, matchesRevealed, nearestBurgle } from "./match.ts";

/** The `burgleMatch` filter: a card of a hand that matches the revealed card of the attempt going on. False for any other card, or with no attempt. */
export function burglePickMatches(state: ScenarioState, id: string, spec: PickSpec, _at: PickContext, ctx: ReduceContext): boolean {
  if (!spec.burgleMatch) return true;
  const found = nearestBurgle(state);
  const data = found?.frame.data;
  const code = data?.effectCardId ? state.cards[data.effectCardId]?.code : undefined;
  const effect = code ? burgleEffectOf(ctx, code) : undefined;
  if (!data || !effect || data.revealedId == null || state.cards[id]?.zone !== "hand") return false;
  return matchesRevealed(state, id, data.revealedId, effect, ctx);
}

/** `mostResources`: of the cards that matched, those holding the most resources. */
export function mostResources(state: ScenarioState, found: readonly string[]): string[] {
  return found.length === 0 ? [] : tiedExtreme(found, (id) => state.cards[id]?.resources ?? 0, "highest");
}

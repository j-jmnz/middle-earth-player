// Rules: dcce.uncharted, rr.search (data/rules/entries.json). The uncharted family's Pick filters (effect-schema-pick.ts): a double-sided location on its Lost Island side, a card
// with enough progress, the bottom cards of a deck, a card costlier than the first card picked, and the decks a card forbids searching.
import type { PickSpec } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { heldAmount } from "../../core/state.ts";
import { isDoubleSided } from "./grotto.ts";

/** The Threat the Lost Island side prints on every copy (the scan, read into the ledger's notes of each Uncharted card: "Threat 2, no quest points"). */
export const LOST_ISLAND_THREAT = 2;

/** A double-sided location lying on its Lost Island side: it has the Uncharted keyword only there (dcce.uncharted). */
export function isLostIsland(instance: Pick<CardInstance, "code" | "face">, ctx: Pick<ReduceContext, "cards">): boolean {
  return instance.face === "B" && printedOf(ctx.cards, instance.code).keywords.uncharted;
}

export function unchartedPickMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  if (spec.uncharted != null && isLostIsland(instance, ctx) !== spec.uncharted) return false;
  if (spec.doubleSided != null && isDoubleSided(state, instance) !== spec.doubleSided) return false;
  if (spec.notCardType != null && printedOf(ctx.cards, instance.code).type === spec.notCardType) return false;
  if (spec.minProgress != null && instance.progress < spec.minProgress) return false;
  return true;
}

/** The cards of a player's deck a filter starts from: the top `top`, the bottom `bottom`, or none while the deck cannot be searched ("your deck cannot be searched", 11069:A:1;
 * "players cannot ... search their decks", 11027:A:1). The cards an effect looked at are not a search and never come through here. */
export function deckPool(state: ScenarioState, seat: number, spec: PickSpec): readonly string[] {
  const deck = state.seats[seat]?.deck ?? [];
  if (spec.bottom != null) return deck.slice(-spec.bottom);
  if (heldAmount(state, "table", "noDeckSearch") > 0 || heldAmount(state, `seat:${seat}`, "noDeckSearch") > 0) return [];
  return deck.slice(0, spec.top ?? Number.MAX_SAFE_INTEGER);
}

// Rules: rr.effects (data/rules/entries.json); ledger lines 09034:A:1, 09039:A:2, 09064:A:1, 09064:A:2.
// The amount `discarded` (src/catalog/effect-schema-amount.ts): what the running effect discarded from the top of decks, all the players it acted for together.
import type { Amount } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { effectData } from "./moves.ts";

/** The amount `discarded`: `cost` the sum of the printed costs of the discarded cards (no cost counts 0), `types` the number of different card types among them. Null for another amount. */
export function discardedAmount(state: ScenarioState, found: Exclude<Amount, number>, ctx: ReduceContext): number | null {
  if (found.discarded == null) return null;
  const ids = effectData(state)?.discardedFromDecks ?? [];
  if (found.discarded === "cost") return ids.reduce((sum, id) => sum + (printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0), 0);
  return new Set(ids.map((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type)).size;
}

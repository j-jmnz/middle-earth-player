// Rules: rr.ally-cards, rr.first-player (data/rules/entries.json); ledger line 21039:A:1.
// The mordor family's pick filter: `highestPrintedAttack`, the allies in play with the highest printed Attack ("the highest attack ally in play", Secret Cultist).
import type { PickSpec } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { PickContext } from "../../interpret/pick.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

/** False when the pick asks for `highestPrintedAttack` and the card's printed Attack is below that of an ally in play; true leaves the other filters to decide. A card with no printed Attack counts 0. */
export function mordorPick(state: ScenarioState, id: string, spec: PickSpec, _at: PickContext, ctx: ReduceContext): boolean {
  if (spec.highestPrintedAttack !== true) return true;
  const attackOf = (cardId: string): number => printedOf(ctx.cards, state.cards[cardId]?.code ?? "").attack ?? 0;
  const allies = Object.values(state.cards).filter((card) => card.zone === "play" && printedOf(ctx.cards, card.code).type === "ally");
  return attackOf(id) >= Math.max(0, ...allies.map((card) => attackOf(card.id)));
}

// Rules: rr.objective-cards, rr.guarded, rr.engaged, emce.indestructible (data/rules/entries.json); ledger lines 12184:B:2, 19051:B:3, 19053:A:1, 19055:A:2.
// What the card preview (table-preview.ts) says of Roam Across Rhovanion's pieces: the trust on Urdug and what it adds, and Urdug and Tiny on their enemy sides once stage 3 has flipped them. The engine decided each; this only says it.
import { flagged } from "../../rules/core/state.ts";
import { printedOf } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

const URDUG = "19052";
const URDUG_ENEMY = "19053";

/** The muted line under Urdug's or Tiny's name, or null. */
export function rhovanionDetail(game: ScenarioState, ctx: ReduceContext, card: ScenarioState["cards"][string]): string | null {
  if (card.code === URDUG || card.code === URDUG_ENEMY) {
    const lines: string[] = [];
    if (card.resources > 0) lines.push(`${card.resources} resource${card.resources === 1 ? "" : "s"} of trust on him: +${card.resources} Willpower, Threat, Attack and Defense`);
    if (card.code === URDUG_ENEMY && (card.zone === "staging" || card.zone === "engaged")) {
      const health = printedOf(ctx.cards, card.code).health ?? 0;
      lines.push(`${card.damage} of ${health} damage: the players win when he has no hit points remaining, and he stays in play even then`);
      if (flagged(game, card.id, "cannotTakeDamage")) lines.push("He takes no damage while Tiny is in play");
    }
    return lines.length > 0 ? `${lines.join(". ")}.` : null;
  }
  return null;
}

// Rules: ats.cair-andros-location-damage, hon.archery, rr.cannot, rr.removed-from-game (data/rules/entries.json); ledger lines 05033:A:1, 05034:A:1, 05035:A:1, 05057:A:2, 05058:A:1.
// What the card preview (table-preview.ts) says of the cards of The Siege of Cair Andros that hold something the table shows nowhere else: a Battleground location's damage against the number that removes it from the game, a hero whose resources cannot be spent, and Orc Arbalesters'
// Archery X. The engine decided each; this only says it. The stage's own lines are in readouts/against-the-shadow/cair-andros.ts (cairAndrosStageLines).
import type { Effect } from "../../../catalog/boundary.ts";
import { cardArchery } from "../../../rules/combat/combat.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { resourcesLocked } from "../../../rules/families/pelargir/spending.ts";
import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { removalLimit } from "../../readouts/against-the-shadow/cair-andros.ts";
import { arbalestersWords, battlegroundWords, lockedResourcesWords } from "../../words/scenarios/against-the-shadow/cair-andros.ts";

const hasStat = (ctx: ReduceContext, code: string, stat: string): boolean => (effectsOf(ctx, code) as readonly Effect[]).some((effect) => effect.timing === "constant" && effect.instructions.some((step) => step.verb === "ModifyStat" && step.stat === stat));

/** The muted line under the card's name in its preview, or null. */
export function cairAndrosDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  const name = printedOf(ctx.cards, card.code).name;
  const limit = removalLimit(game, cardId);
  if (limit > 0 && (card.zone === "staging" || cardId === game.activeLocation)) return battlegroundWords(name, card.damage, limit);
  if (resourcesLocked(game, cardId)) {
    const source = Object.values(game.cards).find((other) => other.zone === "staging" && hasStat(ctx, other.code, "cannotSpendResources"));
    return lockedResourcesWords(source ? printedOf(ctx.cards, source.code).name : "a card");
  }
  if (hasStat(ctx, card.code, "archeryBonus") && (card.zone === "staging" || card.zone === "engaged")) return arbalestersWords(cardArchery(game, ctx.cards, card).own);
  return null;
}

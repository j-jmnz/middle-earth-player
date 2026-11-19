// Rules: rr.attachment-cards (data/rules/entries.json); ledger lines 04125:A:1, 04125:A:2, 04126:A:1, 04126:A:2, 901704:A:1, 901704:A:2, 901705:A:1, 901705:A:2. Foundations of Stone's Nameless enemies: a player card lying on one has no title and no text, and only its printed cost counts; the enemy says
// what it holds and what X is. The engine decided each; this only says it.
import { allAttached, attachedCost, isNamelessCard } from "../../rules/families/nameless/attach.ts";
import { printedOf } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { ownerWords } from "../words/owner.ts";

const cap = (text: string): string => text.replace(/^./, (first) => first.toUpperCase());

/** The muted line under a card's name in its preview: a card on a Nameless enemy says whose it is, that its title and text are blank and what its printed cost adds; the enemy says what it holds and what X is. Null for any other card. */
export function stoneDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (isNamelessCard(game, cardId) && card.host != null) {
    const cost = printedOf(ctx.cards, card.code).cost ?? 0;
    const whose = card.owner != null ? `${cap(ownerWords(game.seatCount, card.owner))} card` : "A card";
    return `${whose}, attached to ${name(card.host)}. It has no title and no text. Its printed cost, ${cost}, counts toward X. It goes to its owner's discard pile when ${name(card.host)} leaves play.`;
  }
  if (!printedOf(ctx.cards, card.code).keywords.statsX || allAttached(game, cardId).length === 0) return null;
  const held = allAttached(game, cardId);
  return `Holds ${held.length} attached ${held.length === 1 ? "card" : "cards"}. X is their printed cost added up, ${attachedCost(game, cardId, ctx.cards)}: its Attack and its hit points.`;
}

// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json). The muted line of a poisoned or unconscious character's preview (Flies and Spiders): its poison against its hit points and what the last one does, or what unconscious means. The engine decided each; this only says it.
import { printedOf } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { poisonOf } from "../../rules/families/poison/poison.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";

/** The words of a character with poison or unconscious, or null for any other card. */
export function poisonDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.unconscious === true) return "Unconscious, turned upside down. It cannot quest, attack, defend, collect resources, trigger abilities, be poisoned or ready, except by an effect that readies an unconscious character.";
  const poison = poisonOf(game, cardId);
  if (poison === 0) return null;
  const limit = printedOf(ctx.cards, card.code).health ?? 0;
  const left = limit - poison;
  const end = left <= 1 ? "One more poison makes it unconscious" : `${left} more poison make it unconscious`;
  return `${poison} poison, facedown under it, of ${limit} hit points. ${end}: it leaves the quest, turns upside down and its poison goes to the discard pile.`;
}

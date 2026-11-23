// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json). The poison of a character on the table (Flies and Spiders): the facedown cards under it, as a night pill "2 poison" (threat red when one more poison makes it unconscious; the preview and the reader say it against the printed hit points), and the word "Unconscious" on a character turned 180 degrees. The reader hears the same words.
import type { UnderMark } from "./card-effects.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { poisonOf } from "../../rules/families/poison/poison.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

/** The pill of a character with poison or unconscious, or null for any other card. */
export function poisonMark(game: ScenarioState, ctx: ReduceContext, cardId: string): UnderMark | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.unconscious === true) return { text: "Unconscious", loses: false, speech: "Unconscious, turned upside down" };
  const poison = poisonOf(game, cardId);
  if (poison === 0) return null;
  const limit = printedOf(ctx.cards, card.code).health ?? 0;
  return { text: `${poison} poison`, loses: limit > 0 && poison + 1 >= limit, speech: `${poison} poison of ${limit} hit points`, count: poison };
}

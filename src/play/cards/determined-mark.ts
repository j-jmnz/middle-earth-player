// Rules: mec108.campaign-log (data/rules/entries.json); ledger line 10172:A:1. What a hero or ally in play wears when the Campaign Log marks its code "determined" (campaignFacts.angmar.determined, read as the filter `determined` reads it) or when a Determination is attached to it
// (the Forced effect marks it determined if the scenario is won). The engine decided both; nothing here changes one. Pure, so a test reads it.
import { DETERMINATION } from "../../effects/authored/angmar-awakened/angmar-awakened.ts";
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import { holds } from "../../rules/interpret/conditions.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { determinedMatches } from "../../rules/families/angmar/determined.ts";

import { CARRIES_WORD, DETERMINED_WORD, determinedWords } from "../words/scenarios/angmar/wastes-table.ts";

/** `word`: the pill's word, "Determined" when the log marks the character and "Determination" when it only carries a copy. `speech`: what the preview and the screen reader say. */
export type DeterminedMark = { word: string; speech: string };

export function determinedMark(game: ScenarioState, ctx: ReduceContext, cardId: string): DeterminedMark | null {
  const card = game.cards[cardId];
  if (!card || !inPlay(card.zone) || card.face === "down") return null;
  // The cheap tests first: only a character that is marked or carries a copy is worth the pick's evaluation (this runs for every card in play, in every scenario).
  const marked = determinedMatches(game, cardId, { type: "character", control: "any", determined: true });
  const carries = card.attachments.some((id) => game.cards[id]?.code === DETERMINATION);
  if (!marked && !carries) return null;
  // A character: a hero, or an ally in play (an objective ally with combat stats, Amarthiúl, is one while a player controls it).
  const character = holds(game, { kind: "matches", card: "self", pick: { type: "character", control: "any" } }, { actor: card.controller ?? 0, sourceId: cardId, returned: 0 }, ctx);
  if (!character) return null;
  return { word: marked ? DETERMINED_WORD : CARRIES_WORD, speech: determinedWords(marked, carries) };
}

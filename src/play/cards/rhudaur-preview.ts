// Rules: mec108.time-x, mec108.side-quests-in-play, mec108.the-investigation, mec108.objective-allies, rr.explored, rr.attachment-cards (data/rules/entries.json); ledger lines 10094:B:1, 10094:B:3, 10095:B:1, 10101:A:1, 10101:A:2, 10109:A:3, 10110:A:1, 10111:A:3, 10112:A:1, 10113:A:3, 10114:A:1.
//
// The preview line of the cards The Treachery of Rhudaur adds: its two stages, Forbidden Descent, the Clue objectives (unclaimed in the staging area, or claimed and lying on a character) and the side quests that flip over. The engine decided every number; nothing here changes one. Pure.
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { questPointsOf } from "../../rules/quest/quest.ts";

import { CLUE_CODES, FORBIDDEN_DESCENT, SECRETS_OF_RHUDAUR, SIDE_QUEST_CODES, THAURDIRS_PURSUIT, claimedClues, pursuitFog, sideQuestsInPlay, spongeTaken, sponges } from "../readouts/rhudaur.ts";
import { CLUE_GIVES, FLIPS_WORDS, clueClaimedWords, clueStagingWords, descentPreviewWords, pursuitWords, secretsPreviewWords } from "../words/scenarios/angmar/rhudaur-table.ts";

/** What a card of The Treachery of Rhudaur's says in its preview, or null for any other card. `name` is a card's title by instance id. */
export function rhudaurDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.code === SECRETS_OF_RHUDAUR && inPlay(card.zone)) return secretsPreviewWords(card.resources, sideQuestsInPlay(game));
  if (card.code === THAURDIRS_PURSUIT && inPlay(card.zone)) {
    const points = questPointsOf(game, card, ctx.cards) ?? 0;
    const printed = printedOf(ctx.cards, card.code).questPoints ?? 0;
    const claimed = claimedClues(game).length;
    return pursuitWords(points, printed, claimed, pursuitFog(game, card, points, printed, claimed));
  }
  if (card.code === FORBIDDEN_DESCENT && card.zone === "staging") {
    const copies = sponges(game);
    return descentPreviewWords(spongeTaken(game, card), card.progress, questPointsOf(game, card, ctx.cards) ?? 0, { index: copies.findIndex((copy) => copy.id === card.id), copies: copies.length });
  }
  if (SIDE_QUEST_CODES.includes(card.code) && card.zone === "staging") return FLIPS_WORDS;
  if (CLUE_CODES.includes(card.code) && inPlay(card.zone)) {
    const gives = CLUE_GIVES[card.code] ?? "";
    const host = card.claimed === true && card.host != null ? game.cards[card.host] : undefined;
    if (!host) return clueStagingWords(gives);
    return clueClaimedWords(name(host.id), game.seatCount > 1 && card.controller != null ? `Player ${card.controller + 1}` : null, gives);
  }
  return null;
}

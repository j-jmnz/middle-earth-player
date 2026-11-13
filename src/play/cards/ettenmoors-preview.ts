// Rules: mec108.safe, mec108.objective-locations, mec108.campaign-setup-across-the-ettenmoors (data/rules/entries.json); ledger lines 10068:A:1, 10069:A:1, 10070:A:1, 10071:A:1, 10077:A:2, 10080:A:1, 10182:A:3.
// The line a card of Across the Ettenmoors says about itself in the card preview (angmar-preview.ts): the campaign card's Losing Time clock, a safe location (what it does now), the card guarding a safe location and the location it guards, an encounter side quest whose text is blank, and No
// Rest on its host. The engine decided each; nothing here changes one. Pure.
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { isSafeLocation } from "../../rules/families/angmar/safe.ts";
import { textBlank } from "../../rules/families/attachments/hold.ts";

import { activeSafeLocation, ettenmoorsCampaignCard, guardedBy, guardOf, isEncounterSideQuest, losingTimeSetAside, NO_REST } from "../readouts/ettenmoors.ts";
import { blankSideQuestWords, guardedByWords, guardsWords, losingTimeWords, noRestHostWords, noRestWords, safeActiveWords, safeStagedWords, safeVictoryWords } from "../words/scenarios/angmar/ettenmoors-table.ts";

export function ettenmoorsDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  const lines: string[] = [];
  if (card.zone === "campaign" && card === ettenmoorsCampaignCard(game)) lines.push(losingTimeWords(card.resources, losingTimeSetAside(game)));
  // A safe location says what it does only where it does it: the staging area (travel) or the active location. In the victory display it says where it lies; in a pile or a peek it says nothing.
  if (isSafeLocation(game, cardId, ctx)) {
    const guard = guardOf(game, cardId);
    if (card.id === game.activeLocation) lines.push(safeActiveWords());
    else if (card.zone === "staging") lines.push(safeStagedWords());
    else if (card.zone === "victory") lines.push(safeVictoryWords());
    if (guard && card.zone === "staging") lines.push(guardedByWords(name(guard.id)));
  }
  const held = guardedBy(game, cardId);
  if (held && isSafeLocation(game, held.id, ctx)) lines.push(guardsWords(name(held.id)));
  const active = activeSafeLocation(game, ctx);
  if (active && card.zone === "staging" && isEncounterSideQuest(game, ctx, cardId) && textBlank(game, cardId, ctx.cards)) lines.push(blankSideQuestWords(name(active.id)));
  if (card.code === NO_REST && card.host != null) lines.push(noRestWords(name(card.host)));
  const bearer = card.attachments.find((id) => game.cards[id]?.code === NO_REST);
  if (bearer && card.zone === "heroes") lines.push(noRestHostWords());
  return lines.length > 0 ? lines.join(" ") : null;
}

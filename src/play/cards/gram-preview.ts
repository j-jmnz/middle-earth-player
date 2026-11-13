// Rules: mec108.captured-cards, mec108.captured-deck, mec108.time-x, mec108.side-quests-in-play (data/rules/entries.json); ledger lines 10053:A:3, 10175:A:1.
// The one line a card of Escape from Mount Gram says about itself in the card preview (angmar-preview.ts): a card captured underneath another (whose it is and what holds it), a host that holds captured cards (how many and whose), Loot the Dungeons in every area and Stop the
// Executioners' time. The engine decided each; nothing here changes one. Pure.
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { questPointsOf } from "../../rules/quest/quest.ts";

import { EXECUTIONERS, LOOT, hasCapturedDecks, heldCapturedLine } from "../readouts/gram.ts";
import { ownerWords } from "../words/owner.ts";
import { capturedCardWords, executionersPreviewWords, lootWords } from "../words/scenarios/gram-table.ts";

export function gramDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  if (!hasCapturedDecks(game)) return null;
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.zone === "captured" && card.host != null) return capturedCardWords(name(card.host), ownerWords(game.seatCount, card.owner));
  const held = heldCapturedLine(game, cardId);
  const lines: string[] = [];
  const points = card.code === LOOT && inPlay(card.zone) ? questPointsOf(game, card, ctx.cards) : null;
  if (points != null) lines.push(lootWords(points, Math.round((points - 4) / 4)));
  if (card.code === EXECUTIONERS && inPlay(card.zone)) lines.push(executionersPreviewWords(card.resources));
  if (held) lines.push(held);
  return lines.length > 0 ? lines.join(" ") : null;
}

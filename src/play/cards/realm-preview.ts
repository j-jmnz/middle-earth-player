// Rules: mec108.reanimated-dead, mec108.indestructible, rr.attachment-cards, rr.removed-from-game (data/rules/entries.json); ledger lines 10153:A:2, 10153:A:3, 10154:A:1, 101157:A:1, 101162:A:2, 101163:A:1.
//
// The preview line of the cards The Dread Realm adds: a Reanimated Dead (what it is and whose card it is, never the face behind it), the Wraith of Carn Dûm lying on a character, Possession on its Reanimated Dead, A Fell Dread on its hero, Daechanar with the Sorcery cards in play and the Altar of
// Midwinter. The engine decided every number; nothing here changes one. Pure.
import { A_FELL_DREAD, ALTAR_OF_MIDWINTER, DAECHANAR, POSSESSION, WRAITH_OF_CARN_DUM } from "../../effects/authored/angmar-awakened/the-dread-realm.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { isReanimatedCode } from "../../rules/core/printed.ts";
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import type { PrintedCard } from "../../rules/core/printed.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";

import { daechanarNow, deadStats, sorceryInPlay } from "../readouts/dread-realm.ts";
import { ownerWords } from "../words/owner.ts";
import { altarWords, daechanarWords, fellDreadWords, possessionAttachedWords, REANIMATED_DEAD, reanimatedPreviewWords, reanimatedSpeech, wraithAttachedWords } from "../words/scenarios/angmar/dread-realm-table.ts";

/** Where a Reanimated Dead lies, as the words read it: the player it is engaged with ("you" solo), or null in the staging area. */
function engagedWith(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  if (card?.zone !== "engaged" || card.controller == null) return null;
  return game.seatCount > 1 ? `Player ${card.controller + 1}` : "you";
}

/** The preview of a Reanimated Dead, as the title, text and effect lines the card preview shows in place of a face: it is never named or pictured. Null for any other card. `name` is a card's title by instance id. */
export function deadPreview(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): { name: string; text: string } | null {
  const card = game.cards[cardId];
  const stats = deadStats(game, ctx.cards, cardId);
  if (!card || !stats) return null;
  const possession = card.attachments.map((id) => game.cards[id]).find((one) => one?.code === POSSESSION);
  return { name: REANIMATED_DEAD, text: reanimatedPreviewWords(stats, ownerWords(game.seatCount, card.owner ?? card.controller ?? 0), { engagedWith: engagedWith(game, cardId) }, possession ? name(possession.id) : null) };
}

/** What a card of The Dread Realm says in its preview, or null for any other card. */
export function realmDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  const host = card.host != null ? game.cards[card.host] : undefined;
  if (card.code === WRAITH_OF_CARN_DUM && card.zone === "attached" && host) return wraithAttachedWords(name(host.id));
  if (card.code === POSSESSION && host && isReanimatedCode(host.code)) return possessionAttachedWords(ownerWords(game.seatCount, host.owner ?? host.controller ?? 0));
  if (card.code === A_FELL_DREAD && host) return fellDreadWords(name(host.id), game.seatCount > 1 && host.controller != null ? `Player ${host.controller + 1}'s` : null);
  if (card.code === DAECHANAR && inPlay(card.zone)) return daechanarWords(sorceryInPlay(game, ctx, cardId), modifiedStat(game, card, "attack", ctx.cards));
  if (card.code === ALTAR_OF_MIDWINTER && inPlay(card.zone)) return altarWords(daechanarNow(game) != null);
  return null;
}

/** What the web list and the screen reader say of a Reanimated Dead after its name, or null for any other card: what it is, where it lies, and whose card it is. */
export function deadSpeech(game: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, cardId: string): string | null {
  const card = game.cards[cardId];
  const stats = deadStats(game, cards, cardId);
  return card && stats ? reanimatedSpeech(stats, ownerWords(game.seatCount, card.owner ?? card.controller ?? 0), { engagedWith: engagedWith(game, cardId) }) : null;
}

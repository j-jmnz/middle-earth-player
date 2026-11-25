// Rules: rm.out-of-play-deck, rr.engaged, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 07024:A:2, 07025:A:1, 07016:A:1, 07016:A:3, 07023:A:1, 07059:A:1, 07059:B:3.
// The one line a card of The Fords of Isen says about itself in the card preview (dungeon-preview.ts): Mugash held under his hero and the Guard that engages its player (To Catch an Orc), Gríma held under The Islet (wherever The Islet lies), free in the staging area, or in a player's play area, and Ill Tidings held in a hand. The engine decided each; nothing here changes one. Pure.
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { GRIMA_IN_STAGING, grimaControlledWords, grimaOnWords, illTidingsWords } from "../../words/scenarios/ring-maker/fords-table.ts";
import { guardWords, heroHoldsWords, mugashHeldWords } from "../../words/scenarios/ring-maker/orc-table.ts";
import { GUARD, MUGASH, mugashLyingOn } from "../../readouts/ring-maker/orc.ts";

const GRIMA = "07016";
const ILL_TIDINGS = "07023";
// The stage whose text stops the quest from advancing unless the first player controls Gríma (07059:B:3).
const STAGE_1 = "07059";

export function ringMakerDetail(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.code === ILL_TIDINGS && card.zone === "hand" && flagged(game, cardId, "cannotLeaveHand")) return illTidingsWords(game.seatCount > 1 && card.controller != null ? `Player ${card.controller + 1}` : null);
  if (card.code === MUGASH) return card.zone === "attached" && card.host != null && game.cards[card.host] ? mugashHeldWords(name(card.host)) : null;
  if (card.code === GUARD && (card.zone === "staging" || card.zone === "engaged")) {
    const held = Object.values(game.cards).find((other) => mugashLyingOn(game, other.id).length > 0);
    return guardWords(held != null, held?.controller != null && game.seatCount > 1 ? `Player ${held.controller + 1}` : null);
  }
  if (mugashLyingOn(game, cardId).length > 0) return heroHoldsWords(name(cardId));
  if (card.code !== GRIMA) return null;
  if (card.zone === "attached" && card.host != null && game.cards[card.host]) return grimaOnWords(name(card.host));
  if (card.zone === "staging" && card.controller == null) return GRIMA_IN_STAGING;
  if (card.controller != null && card.zone === "play") return grimaControlledWords(game.seatCount > 1 ? `Player ${card.controller + 1}` : null, game.questStage != null && game.cards[game.questStage]?.code === STAGE_1);
  return null;
}

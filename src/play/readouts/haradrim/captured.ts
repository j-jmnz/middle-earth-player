// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.guarded, rr.blank (data/rules/entries.json); ledger lines 17119:A:1, 17120:A:1, 17131:A:1, 17132:A:1 (docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md, Table).
// The allies and Abaan an encounter card holds in The Dungeons of Cirith Gurat: a Captive lying under its host (captive zone, `captive`), with no hero slot and no guarded-hero flag, which tells it from a held hero (`staged.ts`) and from the Captives of The Uruk-hai (heroes).
// The table draws each under its host by the draw of every Captive (store/selectors.ts entriesOf); these say who it is and who holds it. Each is read from the state's own facts, never the scenario id. Pure, so a test reads it.
import type { CardInstance, ScenarioState } from "../../../rules/core/state.ts";
import { captivesOf } from "../../../rules/families/captives/values.ts";

import { ownerWords } from "../../words/owner.ts";
import { capturedAbaanWords, capturedAllyWords, capturedDialWords, holdsCapturedWords } from "../../words/scenarios/haradrim/captured-table.ts";

/** A character an encounter card holds that is no hero: an ally of a seat, or Abaan (no owner). */
export const isHeldCharacter = (card: CardInstance): boolean => card.captive === true && card.zone === "captive" && card.host != null && card.guardedHero !== true && card.heroSlot == null && card.prisoner !== true;

/** The ids of the allies and objectives the card holds, in card order (empty for any other card): its preview lists them after it. */
export const heldCharactersUnder = (game: ScenarioState, hostId: string): readonly string[] => captivesOf(game).filter((card) => card.host === hostId && isHeldCharacter(card)).map((card) => card.id);

/** The role of a held ally or Abaan in a preview (it is no attachment), or null. */
export const capturedRole = (game: ScenarioState, cardId: string): string | null => {
  const card = game.cards[cardId];
  return card != null && isHeldCharacter(card) ? (card.owner != null ? "Captured ally" : "Captured objective") : null;
};

/** The preview line of a held ally or Abaan, or of the card that holds one; null for any other card. */
export function capturedDetail(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (isHeldCharacter(card)) {
    const host = name(card.host ?? "");
    return card.owner != null ? capturedAllyWords(ownerWords(game.seatCount, card.owner) ?? "A player's", host) : capturedAbaanWords(host);
  }
  const held = heldCharactersUnder(game, cardId);
  return held.length > 0 ? holdsCapturedWords(held.map((id) => ({ name: name(id), owned: game.cards[id]?.owner != null })), name(cardId)) : null;
}

/** The sentence a seat's dial says of one ally an encounter card holds, or null for any other Captive. */
export function capturedDial(game: ScenarioState, card: CardInstance, nameOf: (code: string) => string): string | null {
  const host = card.host != null ? game.cards[card.host] : undefined;
  return isHeldCharacter(card) && host ? capturedDialWords(nameOf(card.code), nameOf(host.code)) : null;
}

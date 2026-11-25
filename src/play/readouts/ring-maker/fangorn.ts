// Rules: rr.attachment-cards (data/rules/entries.json); ledger line 07058:A:1.
// What the table reads of Into Fangorn's attachments: the ids of In Need of Rest lying on a hero, which its pill names (cards/card-effects.ts). Pure.
import type { ScenarioState } from "../../../rules/core/state.ts";

export const IN_NEED_OF_REST = "07058";

/** The ids of In Need of Rest lying on this card. Empty for any other card and in every other game. */
export function restLyingOn(game: ScenarioState, hostId: string): readonly string[] {
  const host = game.cards[hostId];
  return host == null || host.attachments.length === 0 ? [] : host.attachments.filter((id) => game.cards[id]?.code === IN_NEED_OF_REST);
}

// Rules: dwd.durins-bane, rr.attachment-cards (data/rules/entries.json); ledger lines 04150:A:2, 04145:A:1, 04152:A:1, 04153:A:1. Shadow and Flame's Durin's Bane: which players it is considered engaged with, and the encounter cards attached to it that no player controls.
// The engine decided each (families/south/watcher.ts); this only says it.
import { flagged, livingSeats } from "../../rules/core/state.ts";
import { engagedWithThreatening } from "../../rules/families/south/watcher.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";

/** The muted line under a card's name in its preview: Durin's Bane says the players it is considered engaged with (threat 1 or greater) and that it attacks each of them once in the combat phase, and the players it is not engaged with; an encounter card attached to it says it is no player's. Null for any other card. */
export function flameDetail(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.zone === "staging" && flagged(game, cardId, "engagedWithThreatening")) {
    const seats = livingSeats(game);
    const engaged = seats.filter((seat) => engagedWithThreatening(game, cardId, seat));
    const free = seats.filter((seat) => !engaged.includes(seat));
    const word = (list: readonly number[]) => (game.seatCount > 1 ? list.map((seat) => `Player ${seat + 1}`).join(" and ") : "you");
    const engagedWords = engaged.length > 0 ? `Considered engaged with ${word(engaged)} (threat 1 or more): it attacks ${engaged.length > 1 ? "each" : game.seatCount > 1 ? "them" : "you"} once in the combat phase.` : "Engaged with no player: every threat is 0.";
    return free.length > 0 && game.seatCount > 1 ? `${engagedWords} Not engaged with ${word(free)} (threat 0).` : engagedWords;
  }
  if ((card.zone === "attached" || card.zone === "play") && card.host != null && card.controller == null && flagged(game, card.host, "engagedWithThreatening")) return `An encounter card attached to ${name(card.host)}. No player controls it.`;
  return null;
}

// Rules: rr.ownership-and-control, rr.in-play-and-out-of-play, rr.blank (data/rules/entries.json); ledger lines 143022:A:1, 143024:A:1.
// What the card preview (table-preview.ts) says of a Captive of The Uruk-hai: that it is one, whose hero it is, who holds it, that its text box is blank and no one controls it, and the cards attached to it (they are not drawn beside it).
// The engine decided each; this only says it.
import type { ScenarioState } from "../../rules/engine/reduce.ts";

const TO_ISENGARD = "143022";

// "Player 2's" two-handed, "your" solo.
const whose = (game: ScenarioState, seat: number): string => (game.seatCount > 1 ? `Player ${seat + 1}'s` : "your");

/** The muted line under a Captive's name, or null for any other card. */
export function urukDetail(game: ScenarioState, card: ScenarioState["cards"][string], name: (id: string) => string): string | null {
  if (card.zone !== "captive" || card.captive !== true) return null;
  const holder = card.host ? game.cards[card.host] : undefined;
  const where = holder && holder.code !== TO_ISENGARD ? `held by ${name(holder.id)}` : `under ${holder ? name(holder.id) : "To Isengard!"}`;
  const owner = card.owner != null ? `${whose(game, card.owner)} hero` : "a hero";
  const attached = card.attachments.filter((id) => game.cards[id] != null).map(name);
  const kept = attached.length > 0 ? ` Attached: ${attached.join(", ")}.` : "";
  return `A Captive: ${owner}, ${where}. Its text box is blank and no one controls it.${kept}`;
}

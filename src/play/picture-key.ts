// Which picture a card shows (docs/architecture.md, Images): a card turned to its B side (a quest stage once it is revealed,
// rr.quest-cards-quest-deck) shows its side B picture, bundled as `<code>.B` (scripts/pack-scans.ts); every other card its code's.
// A build with no side B picture for the card falls back to side A (`pictureCode`).
import type { CardFace } from "../rules/state.ts";

/** The picture key of a card as it lies: `<code>.B` on its B side, else its code. */
export function pictureKey(card: { code: string; face: CardFace }): string {
  return card.face === "B" ? `${card.code}.B` : card.code;
}

/** The card code a picture key belongs to: side A's picture, and the card's name and text, are read by it. */
export function pictureCode(key: string): string {
  return key.endsWith(".B") ? key.slice(0, -2) : key;
}

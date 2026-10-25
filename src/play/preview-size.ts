// How large the long-press preview (card-preview.tsx) draws a card. Pure, so tests read it in Node.

// Width over height of a printed card.
const CARD_ASPECT = 0.705;

/** As large as the screen allows, leaving room for the buttons under it; quest cards are printed sideways. */
export function previewSize(width: number, height: number, landscape: boolean): { width: number; height: number } {
  const roomW = Math.max(120, width - 32);
  const roomH = Math.max(160, height - 140);
  if (landscape) {
    const w = Math.min(roomW, roomH / CARD_ASPECT, 640);
    return { width: Math.round(w), height: Math.round(w * CARD_ASPECT) };
  }
  const w = Math.min(roomW - 16, roomH * CARD_ASPECT, 440);
  return { width: Math.round(w), height: Math.round(w / CARD_ASPECT) };
}

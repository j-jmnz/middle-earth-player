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

/**
 * The preview on a wide screen (the table, in landscape): the card at the left as tall as the screen allows, and a column at
 * its right for its name, the effects on it and the cards attached to it.
 */
export function previewSideSize(width: number, height: number, landscape: boolean): { width: number; height: number } {
  const roomH = Math.max(160, height - 32);
  const roomW = Math.max(120, width * 0.55);
  if (landscape) {
    const w = Math.min(roomW, roomH / CARD_ASPECT, 640);
    return { width: Math.round(w), height: Math.round(w * CARD_ASPECT) };
  }
  const h = Math.min(roomH, roomW / CARD_ASPECT, 620);
  return { width: Math.round(h * CARD_ASPECT), height: Math.round(h) };
}

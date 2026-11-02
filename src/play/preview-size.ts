// How large the long-press preview (card-preview.tsx) draws a card. Pure, so tests read it in Node.

// Width over height of a printed card.
const CARD_ASPECT = 0.705;

// The sizes below are Medium's. At a UI `scale` (ui-scale.ts) the screen is measured in logical points (its points over the scale) and
// the card comes back in screen points, so the buttons under it keep their room.

/** As large as the screen allows, leaving room for the buttons under it; quest cards are printed sideways. */
export function previewSize(width: number, height: number, landscape: boolean, scale = 1): { width: number; height: number } {
  const roomW = Math.max(120, width / scale - 32);
  const roomH = Math.max(160, height / scale - 140);
  if (landscape) {
    const w = Math.min(roomW, roomH / CARD_ASPECT, 640);
    return { width: Math.round(w * scale), height: Math.round(w * CARD_ASPECT * scale) };
  }
  const w = Math.min(roomW - 16, roomH * CARD_ASPECT, 440);
  return { width: Math.round(w * scale), height: Math.round((w / CARD_ASPECT) * scale) };
}

/**
 * The preview on a wide screen (the table, in landscape): the card at the left as tall as the screen allows, and a column at
 * its right for its name, the effects on it and the cards attached to it.
 */
export function previewSideSize(width: number, height: number, landscape: boolean, scale = 1): { width: number; height: number } {
  const roomH = Math.max(160, height / scale - 32);
  const roomW = Math.max(120, (width / scale) * 0.55);
  if (landscape) {
    const w = Math.min(roomW, roomH / CARD_ASPECT, 640);
    return { width: Math.round(w * scale), height: Math.round(w * CARD_ASPECT * scale) };
  }
  const h = Math.min(roomH, roomW / CARD_ASPECT, 620);
  return { width: Math.round(h * CARD_ASPECT * scale), height: Math.round(h * scale) };
}

// The most a card is drawn on the Card screen's picture pane, in logical points wide.
const INSPECT_MAX = 420;

/**
 * The card on the Card screen's picture pane (a tablet, docs/design-system.md, Tablets): as large as the pane allows, sized by its
 * height, with 16 points of room around it, and no wider than 420. The pane is in screen points; the card comes back in screen points.
 */
export function inspectSize(paneWidth: number, paneHeight: number, scale = 1): { width: number; height: number } {
  const roomW = Math.max(120, paneWidth / scale - 32);
  const roomH = Math.max(160, paneHeight / scale - 32);
  const w = Math.min(roomW, roomH * CARD_ASPECT, INSPECT_MAX);
  return { width: Math.round(w * scale), height: Math.round((w / CARD_ASPECT) * scale) };
}

// One item of the upright strip (a thumbnail over its label) and the space between items, in Medium's points; an item is a 44 pt target.
export const STRIP_ITEM_W = 60;
export const STRIP_ITEM_H = 62;
export const STRIP_GAP = 6;

/** The upright strip as a grid that fits `room` wide: the fewest rows that hold every item, the items shared evenly among them, and its width and height. */
export function stripGrid(count: number, room: number, s: number): { perRow: number; rows: number; width: number; height: number } {
  const step = (STRIP_ITEM_W + STRIP_GAP) * s;
  const most = Math.max(1, Math.min(count, Math.floor((room + STRIP_GAP * s) / step)));
  // The rows it takes, then the items shared evenly among them (six in two rows of three, not five and one).
  const rows = Math.ceil(count / most);
  const perRow = Math.ceil(count / rows);
  return { perRow, rows, width: perRow * step - STRIP_GAP * s, height: rows * STRIP_ITEM_H * s + (rows - 1) * STRIP_GAP * s };
}

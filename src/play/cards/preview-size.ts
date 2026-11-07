// How large the long-press preview (card-preview.tsx) draws a card. Pure, so tests read it in Node.

import { touch } from "../../ui/ui-scale.ts";

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

// The tokens line under an upright card (docs/design-system-table.md, Cards): body type on a 20 pt line, about 7.2 pt a character, two lines
// at the phone's default text size.
const TOKEN_LINE_PX = 20;
const TOKEN_CHAR_PT = 7.2;

/**
 * The lines the tokens line takes in `width` screen points: two (its cap) at the phone's default text size, as many as its words fill at a
 * larger one (`text`, the font scale), where the cap is lifted (card-preview.tsx).
 */
export function tokenLines(tokens: string, width: number, scale = 1, text = 1): number {
  if (text <= 1) return 2;
  const chars = Math.max(8, Math.floor(width / scale / (TOKEN_CHAR_PT * text)));
  return Math.max(1, Math.ceil(tokens.length / chars));
}

/**
 * The height the strip under an upright card takes, in screen points: the row of the cards with it (a 44 pt target and its 16 pt gap) and
 * the tokens line (12 pt above it and `tokenRows` lines of it, each as tall as the phone's text size makes it). The card gives it up
 * (`previewSize`), so a taller line at a larger text size takes it from the card, never from the controls.
 */
export function previewStrip(a: { chips: boolean; tokenRows: number }, scale = 1, text = 1): number {
  return (a.chips ? touch(scale, 44) + 16 * scale : 0) + (a.tokenRows > 0 ? 12 * scale + a.tokenRows * TOKEN_LINE_PX * scale * text : 0);
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

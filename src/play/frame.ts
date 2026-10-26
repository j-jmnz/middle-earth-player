// The frame of a card: where it is drawn and how it turns. Every mark in the shape of a card (the halo, the gold edge, the
// picked edge, the veil, the beat ring) is drawn on this frame inside the card's turned group, so it follows the card's
// quarter turn or fan tilt; tokens, pills and the check ring stay upright (docs/design-system.md, Table). A touch is turned
// back by the same turn before it is tested against the unturned rectangle.
import type { CardSlot } from "./layout.ts";
import { slotRotation } from "./motion.ts";

export type CardFrame = {
  // The card's center, which it turns about.
  cx: number;
  cy: number;
  // Its unturned size.
  w: number;
  h: number;
  // Its turn in radians: a quarter turn for an exhausted card, the fan's tilt for a hand card.
  rotation: number;
};

/** The card's center, unturned size and turn. The body and every card-shaped mark read it. */
export function cardFrame(slot: CardSlot): CardFrame {
  "worklet";
  return { cx: slot.x + slot.w / 2, cy: slot.y + slot.h / 2, w: slot.w, h: slot.h, rotation: slotRotation(slot) };
}

/** A point turned back about the card's center by the fan's tilt, so it can be tested against the unturned rectangle. */
export function unturn(slot: CardSlot, x: number, y: number): { x: number; y: number } {
  "worklet";
  if (slot.tilt === 0) return { x, y };
  const frame = cardFrame(slot);
  const cos = Math.cos(-slot.tilt);
  const sin = Math.sin(-slot.tilt);
  const dx = x - frame.cx;
  const dy = y - frame.cy;
  return { x: frame.cx + dx * cos - dy * sin, y: frame.cy + dx * sin + dy * cos };
}

// How far past a card's edge the halo's blur may show, in points.
const HALO_REACH = 3;

/**
 * How far to pull the halo's rectangle in from the card's edge. A Gaussian blur spreads about two sigma past a rectangle's
 * edge; pulling the rectangle in by the rest leaves about 3 pt of light showing, so it does not light the next card.
 */
export function haloInset(sigma: number): number {
  return Math.max(0, 2 * sigma - HALO_REACH);
}

// The frame of a card: where it is drawn and how it turns. Every mark in the shape of a card (the halo, the accent edge, the
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

/**
 * A point turned back about the card's center by the turn it is drawn with, so it can be tested against the unturned
 * rectangle. An exhausted card's quarter turn is left to its sideways footprint (`slotBounds`), so only a fan's tilt is undone.
 */
export function unturn(slot: CardSlot, x: number, y: number): { x: number; y: number } {
  "worklet";
  const frame = cardFrame(slot);
  const turn = slot.exhausted ? 0 : frame.rotation;
  if (turn === 0) return { x, y };
  const cos = Math.cos(-turn);
  const sin = Math.sin(-turn);
  const dx = x - frame.cx;
  const dy = y - frame.cy;
  return { x: frame.cx + dx * cos - dy * sin, y: frame.cy + dx * sin + dy * cos };
}

export type Halo = {
  // The blur, in points.
  sigma: number;
  // How far the blurred rectangle is pulled in from the card's edge, in points.
  inset: number;
};

/**
 * The accent light under a card a tap does something with, and the wider one under a picked card. A Gaussian blur at sigma 3
 * has all but faded by the 6 pt gap to the next card, so it is not pulled in. The picked halo (sigma 4.5) is pulled in 1.5
 * pt, so it stops lighting its neighbor yet still reaches farther than the plain one from 3 pt out; nearer the edge its 3 pt
 * accent edge carries it.
 */
export function halo(picked: boolean): Halo {
  return picked ? { sigma: 4.5, inset: 1.5 } : { sigma: 3, inset: 0 };
}

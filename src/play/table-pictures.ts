// The size each card picture on the table is decoded at (docs/architecture.md, Images; docs/design-system.md, Table — landscape,
// Cards): the largest box the canvas draws that code in, so nothing is drawn larger than its copy. A hand card is drawn up to the
// scrub's scale times the lifted card's grow (motion-tokens.ts, SHAPE), so it is decoded at that size; every other card at its slot's
// size. Pure, so a test can weigh a full table's memory.
import type { CardSlot } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";

export type Box = { w: number; h: number };

/** The most the hand scrub grows a hand card: the risen hand's scale times the lifted card's. */
export const HAND_PICTURE_SCALE = SHAPE.scrubScale * SHAPE.scrubLiftScale;

/** The box (in points) each face-up code on the table is drawn in at its largest. */
export function pictureBoxes(slots: readonly CardSlot[]): Map<string, Box> {
  const boxes = new Map<string, Box>();
  for (const slot of slots) {
    if (slot.faceDown || slot.code === "") continue;
    const grow = slot.zone === "hand" ? HAND_PICTURE_SCALE : 1;
    const held = boxes.get(slot.code);
    boxes.set(slot.code, { w: Math.max(held?.w ?? 0, slot.w * grow), h: Math.max(held?.h ?? 0, slot.h * grow) });
  }
  return boxes;
}

/**
 * The pixel size a picture `source` pixels big is kept at to cover `box` at `ratio` pixels a point, keeping its own shape (a quest
 * card's sideways picture stays sideways). Never larger than the file.
 */
export function coverPixels(source: Box, box: Box, ratio: number): Box {
  const scale = Math.min(1, Math.max((box.w * ratio) / source.w, (box.h * ratio) / source.h));
  return { w: Math.max(1, Math.round(source.w * scale)), h: Math.max(1, Math.round(source.h * scale)) };
}

/**
 * Whether a copy decoded for `held` must be decoded again for `wanted`: it is too small to stay sharp, or more than twice the
 * pixels it needs (a card that left the hand), so the table does not hold large copies of small cards. Small changes (a longer
 * hand narrowing its cards) keep the copy.
 */
export function redecode(held: Box | undefined, wanted: Box): boolean {
  if (!held) return true;
  if (held.w < wanted.w - 0.5 || held.h < wanted.h - 0.5) return true;
  return held.w * held.h > 2 * wanted.w * wanted.h;
}

/** The bytes the table's decoded copies take at `ratio` pixels a point (four a pixel), for pictures `source` pixels big. */
export function pictureBytes(boxes: ReadonlyMap<string, Box>, source: Box, ratio: number): number {
  let bytes = 0;
  for (const box of boxes.values()) {
    const pixels = coverPixels(source, box, ratio);
    bytes += pixels.w * pixels.h * 4;
  }
  return bytes;
}

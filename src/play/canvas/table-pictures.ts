// The size each card picture on the table is decoded at (docs/architecture.md, Images; docs/design-system-table.md,
// Cards): the largest box the canvas draws that code in, so nothing is drawn larger than its copy. A hand card is drawn up to the
// scrub's scale times the lifted card's grow (src/ui/motion-tokens.ts, SHAPE), so it is decoded at that size; every other card at its slot's
// size. Pure, so a test can weigh a full table's memory.
import type { CardSlot } from "../layout/layout.ts";
import { SHAPE } from "../../ui/motion-tokens.ts";
import type { CardQualityOption } from "../../ui/table-settings.ts";

export type Box = { w: number; h: number };

/** The most the hand scrub grows a hand card: the risen hand's scale times the lifted card's. */
export const HAND_PICTURE_SCALE = SHAPE.scrubScale * SHAPE.scrubLiftScale;

/**
 * The box (in points) each face-up picture on the table is drawn in at its largest, by picture key (picture-key.ts). A hand card grows
 * in the scrub from the table's card (`card`, hand-scrub.ts), not from its narrowed place in a long hand.
 */
export function pictureBoxes(slots: readonly CardSlot[], card?: Box): Map<string, Box> {
  const boxes = new Map<string, Box>();
  for (const slot of slots) {
    if (slot.faceDown || slot.code === "") continue;
    const hand = slot.zone === "hand";
    const grow = hand ? HAND_PICTURE_SCALE : 1;
    const w = hand && card ? Math.max(slot.w, card.w) : slot.w;
    const h = hand && card ? Math.max(slot.h, card.h) : slot.h;
    // The victory pile's fanned cards are drawn at the pile's size.
    for (const key of [slot.picture ?? slot.code, ...(slot.fan ?? [])]) {
      const held = boxes.get(key);
      boxes.set(key, { w: Math.max(held?.w ?? 0, w * grow), h: Math.max(held?.h ?? 0, h * grow) });
    }
  }
  return boxes;
}

/** The pixels a point holds when card pictures are kept at `quality`: the device's on High, half of it (never below 1) on Low. */
export function pictureRatio(device: number, quality: CardQualityOption): number {
  return quality === "low" ? Math.max(1, device / 2) : device;
}

/** `boxes` (points) as pixel boxes at `ratio` pixels a point, which is what a copy is decoded to cover. */
export function pixelBoxes(boxes: ReadonlyMap<string, Box>, ratio: number): Map<string, Box> {
  return new Map([...boxes].map(([code, box]) => [code, { w: box.w * ratio, h: box.h * ratio }]));
}

/**
 * The pixel size a picture `source` pixels big is kept at to cover `box` at `ratio` pixels a point, keeping its own shape (a quest
 * card's sideways picture stays sideways). Never larger than the file.
 */
export function coverPixels(source: Box, box: Box, ratio: number): Box {
  const scale = Math.min(1, Math.max((box.w * ratio) / source.w, (box.h * ratio) / source.h));
  return { w: Math.max(1, Math.round(source.w * scale)), h: Math.max(1, Math.round(source.h * scale)) };
}

/** How much smaller than wanted, in points, a copy may be and stay sharp enough. */
export const SLACK = 0.5;

/**
 * Whether a copy decoded for `held` must be decoded again for `wanted`: it is too small to stay sharp (more than `slack` short in
 * width or height, in the boxes' own unit: `SLACK` for point boxes, `SLACK * ratio` for boxes in pixels at `ratio` a point), or more
 * than twice the pixels it needs (a card that left the hand), so the table does not hold large copies of small cards. Small changes
 * (a longer hand narrowing its cards) keep the copy.
 */
export function redecode(held: Box | undefined, wanted: Box, slack: number): boolean {
  if (!held) return true;
  if (held.w < wanted.w - slack || held.h < wanted.h - slack) return true;
  return held.w * held.h > 2 * wanted.w * wanted.h;
}

/**
 * What the table asks `boxes` (points) to be decoded at, as a string: each code with its box rounded to whole points, and the
 * `ratio` the copies are kept at, so a change of the Card pictures setting is a change of key and a fraction of a point is not.
 */
export function boxesKey(boxes: ReadonlyMap<string, Box>, ratio: number): string {
  return `${ratio}|${[...boxes].map(([code, box]) => `${code}:${Math.round(box.w)}x${Math.round(box.h)}`).join(",")}`;
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

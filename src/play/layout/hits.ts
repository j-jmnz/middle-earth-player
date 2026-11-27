import { unturn } from "../canvas/frame.ts";
import type { CardSlot, Rect } from "./layout.ts";
import { PEEK } from "./layout.ts";
import { MIN_TARGET } from "./slots.ts";

// Where a tap or a drag lands on the table: the rectangle a slot is drawn in (turned when exhausted, narrowed where the
// Stormcaller's area covers it) and the slot or drop target under a point. Worklets: the gestures test on the UI thread.

/** The rectangle a slot covers on screen: an exhausted card is turned sideways about its center. */
export function slotBounds(slot: CardSlot): Rect {
  "worklet";
  if (!slot.exhausted) return slot;
  return { x: slot.x + (slot.w - slot.h) / 2, y: slot.y + (slot.h - slot.w) / 2, w: slot.h, h: slot.w };
}

/**
 * The part of a slot the strip, the tokens and the pops are drawn in: its bounds, narrowed to what the Stormcaller's area cards leave
 * uncovered of the stage, and cut off where the front row of stacked play rows starts.
 */
export function shownBounds(slot: CardSlot): Rect {
  const bounds = slotBounds(slot);
  const wide = slot.shown != null ? { ...bounds, w: Math.min(bounds.w, slot.shown) } : bounds;
  return slot.coveredFrom != null ? { ...wide, h: Math.max(0, Math.min(wide.h, slot.coveredFrom - wide.y)) } : wide;
}

/** The rectangle a tap or a drag finds a slot in: its bounds, grown to 44 pt for a pile drawn smaller than that. */
export function hitBounds(slot: CardSlot): Rect {
  "worklet";
  const bounds = slotBounds(slot);
  if (slot.kind !== "pile" || (bounds.w >= MIN_TARGET && bounds.h >= MIN_TARGET)) return bounds;
  const w = Math.max(bounds.w, MIN_TARGET);
  const h = Math.max(bounds.h, MIN_TARGET);
  return { x: bounds.x - (w - bounds.w) / 2, y: bounds.y - (h - bounds.h) / 2, w, h };
}

export function contains(rect: Rect, x: number, y: number): boolean {
  "worklet";
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** The rectangle a tap finds an attachment in: the band of it that shows under its host (the bottom PEEK of its card), grown to 44 pt tall about its middle. Only a point no card holds reaches it (`hitSlot`). */
export function bandBounds(slot: CardSlot): Rect {
  "worklet";
  const middle = slot.y + slot.h - PEEK / 2;
  return { x: slot.x, y: middle - MIN_TARGET / 2, w: slot.w, h: MIN_TARGET };
}

// The attachment whose 44 pt band holds the point, topmost first, or -1: a held or hung objective is a strip 10 pt tall, too thin to hit on its own.
function hitBand(slots: readonly CardSlot[], x: number, y: number): number {
  "worklet";
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index];
    if (slot && slot.kind === "attachment" && !slot.faceDown && contains(bandBounds(slot), x, y)) return index;
  }
  return -1;
}

/** The topmost card slot under a point, or -1. Later slots are drawn on top. A tilted card is hit where it is drawn. A point no card holds finds the attachment whose band is near it. */
export function hitSlot(slots: readonly CardSlot[], x: number, y: number): number {
  "worklet";
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index];
    if (!slot) continue;
    // A fanned card is tested as it is drawn: the point is turned back by the tilt about the card's center.
    const point = unturn(slot, x, y);
    if (contains(hitBounds(slot), point.x, point.y)) return index;
  }
  return hitBand(slots, x, y);
}

// A drop target with the rectangle it occupies, so the worklet can test it without the layout.
export type DropRect = Rect & { target: string };

/** The drop target under a point, or "" when there is none. Card targets are tested before zones. */
export function hitDrop(drops: readonly DropRect[], x: number, y: number): string {
  "worklet";
  for (let index = 0; index < drops.length; index += 1) {
    const drop = drops[index];
    if (drop && contains(drop, x, y)) return drop.target;
  }
  return "";
}

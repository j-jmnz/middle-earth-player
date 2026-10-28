// The hand scrub (docs/design-system.md, Table, Gestures; phase 25): pressed and held, the hand rises and spreads across the
// canvas, and a finger sliding along it lifts one card at a time; letting go on a card opens its preview. Pure geometry: the
// canvas animates between the hand layout.ts gives (the peeking, fanned strip) and the spread this works out, and the gesture's
// worklets ask `cardAt`, `cancelled` and `pick` for the card under the finger on the UI thread. Nothing here sends an intent.
//
// The hold (250 ms) and the slop (6 pt) are gesture thresholds, not motion: they stay out of motionScale, as the dock's ARM_MS does.
import { contains, hitSlot, MIN_TARGET, type CardSlot, type Rect, type TableLayout } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";
import { touch } from "./ui-scale.ts";

/** How long a press on the hand is held still before the scrub starts, in ms. */
export const SCRUB_HOLD_MS = 250;

/** How far the finger may move in that time, in pt; a move before it is a drag, which plays a card as always. */
export const SCRUB_SLOP = 6;

// The risen hand keeps this far from the canvas's edges, and its cards this far apart when there is room. These are Medium's sizes;
// the layout's UI scale (layout.scale) multiplies them.
const EDGE = 8;
const GAP = 6;

/**
 * The risen, spread hand. `slots` are the rectangles the cards reach (already at the scrub's scale, untilted and unlifted), one per
 * card in hand order; `centers` their x centers; `top` the y of the risen hand's top edge, above which the scrub cancels; `left` and
 * `right` its extent; `strip` the normal hand's rectangle, where a press can start a scrub; `reach` the slice of each card a finger is
 * guaranteed and the distance above the hand where it cancels (44 pt, more at Large), carried here so the worklets read it from the
 * spread rather than a module constant. Absent means 44.
 */
export type Spread = { ids: readonly string[]; slots: readonly Rect[]; centers: readonly number[]; scale: number; top: number; left: number; right: number; strip: Rect; reach?: number };

export const NO_SPREAD: Spread = { ids: [], slots: [], centers: [], scale: 1, top: 0, left: 0, right: 0, strip: { x: 0, y: 0, w: 0, h: 0 } };

/** The hand's slots in order. */
export function handSlots(layout: TableLayout): CardSlot[] {
  return layout.slots.filter((slot) => slot.zone === "hand" && slot.kind === "card");
}

/**
 * The hand risen and spread across the canvas: whole cards at the scrub's scale (1.5), centered, a gap apart when they fit and
 * overlapping evenly when they do not, always at least a 44 pt slice of each. A hand too wide for that at 1.5 gets a smaller scale
 * instead of a thinner slice. `canvas.bottom` is the bottom safe-area inset the hand stays above.
 */
export function spreadLayout(layout: TableLayout, canvas: { width: number; height: number; bottom: number }): Spread {
  const cards = handSlots(layout);
  const first = cards[0];
  if (!first) return { ...NO_SPREAD, strip: layout.zones.hand };
  const count = cards.length;
  const ui = layout.scale ?? 1;
  const edge = EDGE * ui;
  const gap = GAP * ui;
  const reach = touch(ui, MIN_TARGET);
  const room = canvas.width - 2 * edge;
  const scale = Math.min(SHAPE.scrubScale, (room - (count - 1) * reach) / first.w);
  const w = first.w * scale;
  const h = first.h * scale;
  const step = count > 1 ? Math.min(w + gap, (room - w) / (count - 1)) : 0;
  const x0 = (canvas.width - ((count - 1) * step + w)) / 2;
  const y = canvas.height - canvas.bottom - h - gap;
  const slots = cards.map((_, index) => ({ x: x0 + index * step, y, w, h }));
  return { ids: cards.map((card) => card.id), slots, centers: slots.map((slot) => slot.x + slot.w / 2), scale, top: y, left: x0, right: x0 + (count - 1) * step + w, strip: layout.zones.hand, reach };
}

/** The index of the card whose center is nearest `x`, or -1 for an empty hand. */
export function cardAt(spread: Spread, x: number): number {
  "worklet";
  let best = -1;
  let gap = Infinity;
  for (let index = 0; index < spread.centers.length; index += 1) {
    const away = Math.abs((spread.centers[index] ?? 0) - x);
    if (away < gap) {
      gap = away;
      best = index;
    }
  }
  return best;
}

/** Whether the finger is more than 44 pt above the top of the risen hand (the lifted card stands above it): cancelled for good. */
export function cancelled(spread: Spread, y: number): boolean {
  "worklet";
  return y < spread.top - (spread.reach ?? MIN_TARGET);
}

/**
 * The card a release or a move lands on: the nearest center, or -1 when the finger is above the hand or off its ends (by half of
 * the slice a card is guaranteed). -1 lifts nothing, and a release on it cancels.
 */
export function pick(spread: Spread, x: number, y: number): number {
  "worklet";
  const margin = (spread.reach ?? MIN_TARGET) / 2;
  if (spread.ids.length === 0 || cancelled(spread, y) || x < spread.left - margin || x > spread.right + margin) return -1;
  return cardAt(spread, x);
}

/** Whether a press at a point starts a scrub: on a hand card, or on the hand strip between cards, and not on another card. */
export function startsScrub(spread: Spread, slots: readonly CardSlot[], x: number, y: number, hit: number): boolean {
  "worklet";
  if (spread.ids.length === 0) return false;
  const slot = hit >= 0 ? slots[hit] : undefined;
  if (slot) return slot.zone === "hand";
  return contains(spread.strip, x, y);
}

/** The card the scrub starts on: the hand card that was pressed, else (the strip between cards) the one nearest the finger. */
export function startCard(spread: Spread, slots: readonly CardSlot[], x: number, y: number): number {
  "worklet";
  const slot = slots[hitSlot(slots, x, y)];
  const pressed = slot && slot.zone === "hand" ? spread.ids.indexOf(slot.id) : -1;
  return pressed >= 0 ? pressed : cardAt(spread, x);
}

/** The selection tick: when the scrub starts on a card and each time the card under the finger changes to another, nothing else. */
export function ticksOn(previous: number, next: number): boolean {
  return next >= 0 && next !== previous;
}

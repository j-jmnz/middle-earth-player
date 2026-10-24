// Where each zone and card sits on the one table canvas. Pure geometry: the canvas draws these rectangles, and the drag
// worklets hit-test them on the UI thread (the functions marked "worklet" run there; in Node the directive is an unused
// string). Zones are regions of the felt with no boxed labels (docs/design-system.md, Table).
import type { CardInstance } from "../rules/state.ts";

import type { ZoneEntry, ZoneId, ZoneView } from "./selectors.ts";

export type Rect = { x: number; y: number; w: number; h: number };

export type SlotKind = "card" | "attachment" | "shadow";

export type CardSlot = Rect & {
  id: string;
  code: string;
  zone: ZoneId;
  kind: SlotKind;
  exhausted: boolean;
  faceDown: boolean;
  // Quest cards are printed sideways.
  landscape: boolean;
  resources: number;
  damage: number;
  progress: number;
  // A slight turn for the hand fan, in radians.
  tilt: number;
};

export type TableLayout = {
  width: number;
  height: number;
  card: { w: number; h: number };
  zones: Readonly<Record<ZoneId, Rect>>;
  slots: readonly CardSlot[];
};

export type LayoutViews = Readonly<Record<ZoneId, ZoneView>>;

const GUTTER = 12;
const GAP = 8;
const BAND = 72;
const PEEK = 12;
const ASPECT = 1.4;

/** The card size that fits five across and every row in the height the canvas has. */
export function cardSize(width: number, height: number): { w: number; h: number } {
  const byWidth = (width - 2 * GUTTER - 4 * GAP) / 5;
  const byHeight = (height - BAND - 5 * GAP - 2 * PEEK) / (ASPECT * 3.85);
  const w = Math.max(36, Math.floor(Math.min(byWidth, byHeight, 84)));
  return { w, h: Math.round(w * ASPECT) };
}

export const MIN_TARGET = 44;

/** The size of a hand card: the table's card, narrowed so `count` cards overlap by no more than leaves 44 pt of each. */
export function handCardSize(card: { w: number; h: number }, width: number, count: number): { w: number; h: number } {
  if (count <= 1) return card;
  const w = Math.max(36, Math.min(card.w, Math.floor(width - MIN_TARGET * (count - 1))));
  return w === card.w ? card : { w, h: Math.round(w * ASPECT) };
}

function slotOf(card: CardInstance, zone: ZoneId, kind: SlotKind, rect: Rect, landscape = false, tilt = 0): CardSlot {
  return {
    ...rect,
    id: card.id,
    code: card.code,
    zone,
    kind,
    exhausted: card.exhausted,
    faceDown: card.face === "down",
    landscape,
    resources: card.resources,
    damage: card.damage,
    progress: card.progress,
    tilt,
  };
}

// Positions for `count` cards across a row from `x` to `x + width`: spaced by one gap, overlapping when they do not fit.
function rowXs(count: number, x: number, width: number, cardWidth: number): number[] {
  if (count === 0) return [];
  const natural = cardWidth + GAP;
  const step = count === 1 ? 0 : Math.min(natural, (width - cardWidth) / (count - 1));
  return Array.from({ length: count }, (_, index) => x + index * step);
}

function placeRow(entries: readonly ZoneEntry[], zone: ZoneId, area: Rect, card: { w: number; h: number }, out: CardSlot[], shadows = false): void {
  const xs = rowXs(entries.length, area.x, area.w, card.w);
  entries.forEach((entry, index) => {
    const x = xs[index] ?? area.x;
    // Attachments peek out from under the host, the most recent lowest.
    entry.attached.forEach((attached, at) => {
      const kind: SlotKind = shadows && attached.zone === "shadow" ? "shadow" : "attachment";
      out.push(slotOf(attached, zone, kind, { x, y: area.y + (entry.attached.length - at) * PEEK, w: card.w, h: card.h }));
    });
    out.push(slotOf(entry.card, zone, "card", { x, y: area.y, w: card.w, h: card.h }));
  });
}

/**
 * The table for one seat: the pinned quest stage at the top, then staging, the active location beside the engaged enemies
 * (each carrying its shadow card), the play area, and the hand fanned at the bottom.
 */
export function tableLayout(width: number, height: number, views: LayoutViews): TableLayout {
  const card = cardSize(width, height);
  const inner = width - 2 * GUTTER;
  const stage: Rect = { x: GUTTER, y: 0, w: inner, h: BAND };
  const stagingY = BAND + GAP;
  const staging: Rect = { x: GUTTER, y: stagingY, w: inner, h: card.h };
  const middleY = stagingY + card.h + GAP;
  const hasSecond = views.secondActiveLocation.entries.length > 0;
  const locationsWidth = card.w * (hasSecond ? 2 : 1) + (hasSecond ? GAP : 0);
  const activeLocation: Rect = { x: GUTTER, y: middleY, w: card.w, h: card.h + PEEK };
  const secondActiveLocation: Rect = { x: GUTTER + card.w + GAP, y: middleY, w: hasSecond ? card.w : 0, h: hasSecond ? card.h + PEEK : 0 };
  const engaged: Rect = { x: GUTTER + locationsWidth + GAP * 2, y: middleY, w: inner - locationsWidth - GAP * 2, h: card.h + PEEK };
  const playY = middleY + card.h + PEEK + GAP;
  const play: Rect = { x: GUTTER, y: playY, w: inner, h: card.h + PEEK * 2 };
  const handY = playY + card.h + PEEK * 2 + GAP;
  const hand: Rect = { x: GUTTER, y: handY, w: inner, h: Math.max(card.h, height - handY) };

  const slots: CardSlot[] = [];
  const stageEntry = views.questStage.entries[0];
  if (stageEntry) {
    // The stage art is small and sideways at the left of the band; its name and progress are text beside it.
    const h = BAND - GAP;
    slots.push(slotOf(stageEntry.card, "questStage", "card", { x: GUTTER, y: GAP / 2, w: Math.round(h * ASPECT), h }, true));
  }
  placeRow(views.staging.entries, "staging", staging, card, slots);
  placeRow(views.activeLocation.entries, "activeLocation", activeLocation, card, slots);
  placeRow(views.secondActiveLocation.entries, "secondActiveLocation", secondActiveLocation, card, slots);
  // An engaged enemy's shadow card sits under it, face down until its attack.
  placeRow(views.engaged.entries, "engaged", engaged, card, slots, true);
  placeRow(views.play.entries, "play", play, card, slots);

  // The hand fans: a slight turn from the middle out, overlapping when it is long.
  const handEntries = views.hand.entries;
  // Each hand card keeps at least a 44 pt strip to touch: a long hand narrows its cards before the strip gets thinner.
  const handCard = handCardSize(card, hand.w, handEntries.length);
  const xs = rowXs(handEntries.length, hand.x, hand.w, handCard.w);
  const middle = (handEntries.length - 1) / 2;
  handEntries.forEach((entry, index) => {
    const offset = index - middle;
    slots.push(slotOf(entry.card, "hand", "card", { x: xs[index] ?? hand.x, y: handY + Math.abs(offset) * 3, w: handCard.w, h: handCard.h }, false, offset * 0.04));
  });

  return { width, height, card, zones: { questStage: stage, staging, activeLocation, secondActiveLocation, engaged, play, hand }, slots };
}

export function contains(rect: Rect, x: number, y: number): boolean {
  "worklet";
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** The topmost card slot under a point, or -1. Later slots are drawn on top. */
export function hitSlot(slots: readonly CardSlot[], x: number, y: number): number {
  "worklet";
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index];
    if (slot && contains(slot, x, y)) return index;
  }
  return -1;
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

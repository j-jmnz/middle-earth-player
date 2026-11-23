// The pieces the table's layout places cards with (layout.ts, play-area.ts): a card's slot, its footprint in a row, a row's left
// edges, and the cards peeking out under a host. Pure.
import { isReanimatedCode } from "../../rules/core/printed.ts";
import { isExhausted, type CardInstance } from "../../rules/core/state.ts";

import type { CardSlot, Rect, SlotKind, SlotZone } from "./layout.ts";
import type { ZoneEntry, ZoneId } from "../store/selectors.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { isPrisoner } from "../store/selectors.ts";

export const ASPECT = 1.4;

export const MIN_TARGET = 44;

// Characters fighting the same enemy, and a guard over the objective it guards, overlap by this much of a card.
export const PAIR_STEP = 0.72;

// The sizes the layout works in, at one UI scale.
export type Metrics = { scale: number; gutter: number; gap: number; peek: number; handMin: number; mark: number };

export function slotOf(card: CardInstance, zone: SlotZone, kind: SlotKind, rect: Rect, landscape = false, tilt = 0): CardSlot {
  return {
    ...rect,
    id: card.id,
    // An enemy grappled with a location is facedown and unnamed: its slot is a back and carries no code (a card's code names it and draws its picture).
    code: card.zone === "grappled" ? "" : card.code,
    ...(card.face === "B" ? { picture: pictureKey(card) } : {}),
    zone,
    kind,
    exhausted: isExhausted(card),
    ...(card.unconscious === true ? { unconscious: true as const } : {}),
    faceDown: card.face === "down",
    landscape,
    resources: card.resources,
    damage: card.damage,
    progress: card.progress,
    tilt,
    count: 0,
    committed: card.committed,
    ...(card.face === "down" && isPrisoner(card) ? { held: true as const } : {}),
    ...(isReanimatedCode(card.code) ? { dead: true as const } : {}),
  };
}

// The width a card takes in a row: an exhausted card is turned sideways.
export function footprint(card: CardInstance, size: { w: number; h: number }): number {
  return isExhausted(card) ? size.h : size.w;
}

// Left edges for items of these widths across a row from `x` to `x + width`: spaced by one gap, squeezed (overlapping) when
// they do not fit.
export function rowXs(widths: readonly number[], x: number, width: number, gap: number): number[] {
  if (widths.length === 0) return [];
  const natural = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
  const squeeze = widths.length > 1 && natural > width ? (natural - width) / (widths.length - 1) : 0;
  const xs: number[] = [];
  let at = x;
  for (const w of widths) {
    xs.push(at);
    at += w + gap - squeeze;
  }
  return xs;
}

// A card at the left edge `x` of its footprint: an exhausted card is drawn centered in its sideways footprint.
export function cardRect(card: CardInstance, x: number, y: number, size: { w: number; h: number }): Rect {
  const offset = isExhausted(card) ? (size.h - size.w) / 2 : 0;
  return { x: x + offset, y, w: size.w, h: size.h };
}

// Attachments and face-down shadow cards peek out from under the host, the most recent lowest.
export function placeUnder(entry: ZoneEntry, zone: ZoneId, rect: Rect, out: CardSlot[], faceUpShadows: CardInstance[], peek: number): void {
  const under = entry.attached.filter((attached) => !(attached.zone === "shadow" && attached.face !== "down"));
  under.forEach((attached, at) => {
    const kind: SlotKind = attached.zone === "shadow" ? "shadow" : "attachment";
    out.push(slotOf(attached, zone, kind, { x: rect.x, y: rect.y + (under.length - at) * peek, w: rect.w, h: rect.h }));
  });
  faceUpShadows.push(...entry.attached.filter((attached) => attached.zone === "shadow" && attached.face !== "down"));
}

// The most cards peeking out under one card of these entries: attachments and face-down shadow cards.
export function deepestUnder(entries: readonly ZoneEntry[]): number {
  return Math.max(0, ...entries.map((entry) => entry.attached.filter((attached) => !(attached.zone === "shadow" && attached.face !== "down")).length));
}

// One peek under a card of the left column (the quest stage, an active location) that holds cards, with the count when there are several: the last put is the one that shows. `landscape` is a sideways card's (the quest stage).
export function placeCounted(entry: ZoneEntry, zone: ZoneId, rect: Rect, out: CardSlot[], peek: number, landscape = false): void {
  const under = entry.attached.filter((card) => !(card.zone === "shadow" && card.face !== "down"));
  const last = under[under.length - 1];
  if (!last) return;
  const slot = slotOf(last, zone, last.zone === "shadow" ? "shadow" : "attachment", { x: rect.x, y: rect.y + peek, w: rect.w, h: rect.h }, landscape);
  out.push(under.length > 1 ? { ...slot, stack: under.length } : slot);
}

// One peek under a staging card that holds more than one card, with the count: a grappled arm, Black Key on the Raider Flagship (the last put is the one that shows).
export function placeStaging(entry: ZoneEntry, rect: Rect, out: CardSlot[], m: Metrics): void {
  const under = entry.attached.filter((card) => !(card.zone === "shadow" && card.face !== "down"));
  if (under.length <= 1) {
    placeUnder(entry, "staging", rect, out, [], m.peek);
    return;
  }
  const last = under[under.length - 1] as CardInstance;
  out.push({ ...slotOf(last, "staging", last.zone === "shadow" ? "shadow" : "attachment", { x: rect.x, y: rect.y + m.peek, w: rect.w, h: rect.h }), stack: under.length });
}

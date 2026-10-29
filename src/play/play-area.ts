// The play area's rows (docs/design-system.md, Table — landscape, Spacing and the play area's rows; user request, 2026-10-29): the
// player's cards in play wrap onto more rows when they fit, shrink when they do not, and squeeze one row under the floor. Pure.
import type { CardSlot, Rect } from "./layout.ts";
import { ASPECT, cardRect, deepestUnder, footprint, MIN_TARGET, placeUnder, rowXs, slotOf, type Metrics } from "./layout-slots.ts";
import type { ZoneEntry } from "./selectors.ts";
import { wrapRows } from "./table-spacing.ts";
import { touch } from "./ui-scale.ts";

// The play area's cards shrink to this share of the table's card at the least so their rows fit (never under a 44 pt target);
// under it they squeeze into one row as the other rows do.
export const PLAY_FLOOR = 0.7;
// A squeeze of up to this share of a card's width keeps the table's card rather than shrinking the play area.
const SLIGHT_SQUEEZE = 0.2;

// The play area's rows, each card at `size`: a row takes cards left to right a gap apart and wraps when the next would not fit.
function playRows(entries: readonly ZoneEntry[], size: { w: number; h: number }, width: number, m: Metrics): ZoneEntry[][] {
  return wrapRows(entries.map((entry) => footprint(entry.card, size)), width, m.gap).map((row) => row.map((at) => entries[at] as ZoneEntry));
}

// How deep a play row is: its card and the attachments peeking out under it.
function rowDepth(row: readonly ZoneEntry[], size: { w: number; h: number }, m: Metrics): number {
  return size.h + m.peek * deepestUnder(row);
}

function rowsHeight(rows: readonly (readonly ZoneEntry[])[], size: { w: number; h: number }, m: Metrics): number {
  return rows.reduce((sum, row) => sum + rowDepth(row, size, m), 0) + m.gap * Math.max(0, rows.length - 1);
}

/** The play area's cards: their size, their rows and how tall the band they fill is. */
export type PlayPlan = { size: { w: number; h: number }; rows: readonly (readonly ZoneEntry[])[]; h: number };

/**
 * The play area in a band `band` tall (its own row's room plus the spare under it): the table's card in as many rows as it needs
 * when they fit; else the largest smaller card, down to PLAY_FLOOR of it and a 44 pt target, whose rows fit; else one row of the
 * table's card, squeezed, as before.
 */
export function playPlan(entries: readonly ZoneEntry[], width: number, card: { w: number; h: number }, oneRow: number, band: number, m: Metrics): PlayPlan {
  const squeezed: PlayPlan = { size: card, rows: [entries], h: oneRow };
  const full = playRows(entries, card, width, m);
  if (full.length <= 1) return squeezed;
  if (rowsHeight(full, card, m) <= band) return { size: card, rows: full, h: Math.max(oneRow, rowsHeight(full, card, m)) };
  // A slight squeeze (each card overlapping its neighbour by a fifth of a card at most, every step still a target) keeps the table's
  // card: a play area that changes size for a point or two each time a card exhausts reads as a mistake.
  const natural = entries.reduce((sum, entry) => sum + footprint(entry.card, card), 0) + m.gap * (entries.length - 1);
  const overlap = (natural - width) / (entries.length - 1);
  if (overlap <= card.w * SLIGHT_SQUEEZE && card.w + m.gap - overlap >= touch(m.scale, MIN_TARGET)) return squeezed;
  const floor = Math.max(Math.round(card.w * PLAY_FLOOR), touch(m.scale, MIN_TARGET));
  for (let w = card.w - 1; w >= floor; w -= 1) {
    const size = { w, h: Math.round(w * ASPECT) };
    const rows = playRows(entries, size, width, m);
    if (rowsHeight(rows, size, m) <= band) return { size, rows, h: Math.max(oneRow, rowsHeight(rows, size, m)) };
  }
  return squeezed;
}

// The play area, row under row; a row that does not fit (the squeezed fallback) overlaps its cards as staging does.
export function placePlay(plan: PlayPlan, area: Rect, out: CardSlot[], m: Metrics): void {
  let y = area.y;
  for (const row of plan.rows) {
    const xs = rowXs(row.map((entry) => footprint(entry.card, plan.size)), area.x, area.w, m.gap);
    row.forEach((entry, at) => {
      const rect = cardRect(entry.card, xs[at] ?? area.x, y, plan.size);
      placeUnder(entry, "play", rect, out, [], m.peek);
      // A committed character stands a step higher, sent toward the quest.
      const lift = entry.card.committed ? -m.peek / 2 : 0;
      out.push(slotOf(entry.card, "play", "card", { ...rect, y: rect.y + lift }));
    });
    y += rowDepth(row, plan.size, m) + m.gap;
  }
}

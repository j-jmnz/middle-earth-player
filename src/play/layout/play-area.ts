// The play area's rows (docs/design-system-table.md, Spacing and the play area's rows; user request, 2026-10-29): the
// player's cards in play wrap onto more rows when they fit, shrink when they do not, and squeeze one row under the floor. Pure.
import type { CardSlot, Rect } from "./layout.ts";
import { ASPECT, cardRect, deepestUnder, footprint, MIN_TARGET, placeUnder, rowXs, slotOf, type Metrics } from "./slots.ts";
import type { ZoneEntry } from "../store/selectors.ts";
import { wrapRows } from "./table-spacing.ts";
import { touch } from "../../ui/ui-scale.ts";
import { isExhausted } from "../../rules/core/state.ts";

// After a seat's last ship the row keeps one more gap, so the ships read as a group without a box (dcce.ship-objectives; `SHIP_GAP` is one `GAP`).
export const SHIP_GAP = 1;

// The play area's cards shrink to this share of the table's card at the least so their rows fit (never under a 44 pt target);
// under it they squeeze into one row as the other rows do.
export const PLAY_FLOOR = 0.7;
// A squeeze of up to this share of a card's width keeps the table's card rather than shrinking the play area.
const SLIGHT_SQUEEZE = 0.2;
// Two stacked rows may tuck this far (Medium's points, times the UI scale) under the top of the hand's strip, which is drawn over them.
export const HAND_TUCK = 10;

// The room each entry takes in a row: its footprint, and the extra gap after the last ship while another card follows it.
export function playWidths(entries: readonly ZoneEntry[], size: { w: number; h: number }, m: Metrics): number[] {
  return entries.map((entry, at) => footprint(entry.card, size) + (entry.ship != null && entries[at + 1] != null && entries[at + 1]?.ship == null ? SHIP_GAP * m.gap : 0));
}

// The play area's rows, each card at `size`: a row takes cards left to right a gap apart and wraps when the next would not fit.
function playRows(entries: readonly ZoneEntry[], size: { w: number; h: number }, width: number, m: Metrics): ZoneEntry[][] {
  return wrapRows(playWidths(entries, size, m), width, m.gap).map((row) => row.map((at) => entries[at] as ZoneEntry));
}

// How deep a play row is: its card and the attachments peeking out under it.
function rowDepth(row: readonly ZoneEntry[], size: { w: number; h: number }, m: Metrics): number {
  return size.h + m.peek * deepestUnder(row);
}

function rowsHeight(rows: readonly (readonly ZoneEntry[])[], size: { w: number; h: number }, m: Metrics): number {
  return rows.reduce((sum, row) => sum + rowDepth(row, size, m), 0) + m.gap * Math.max(0, rows.length - 1);
}

/** The play area's cards: their size, their rows, how tall the band they fill is, and the step between stacked rows (absent: a gap apart). */
export type PlayPlan = { size: { w: number; h: number }; rows: readonly (readonly ZoneEntry[])[]; h: number; pitch?: number };

// The smallest step between neighbours when `row` is laid out across `width` at `size` (squeezed when it does not fit).
function rowStep(row: readonly ZoneEntry[], size: { w: number; h: number }, width: number, m: Metrics): number {
  if (row.length <= 1) return Infinity;
  const natural = playWidths(row, size, m).reduce((sum, w) => sum + w, 0) + m.gap * (row.length - 1);
  return size.w + m.gap - Math.max(0, natural - width) / (row.length - 1);
}

// The two rows of a stack, back then front: the ships go to the front row's left end (their attachments still peek and their damage stays in reach),
// the front row as long as the back row would leave it; the rest keep their order. Without a ship it is the plain halves.
function stackedRows(entries: readonly ZoneEntry[]): ZoneEntry[][] {
  const half = Math.ceil(entries.length / 2);
  const ships = entries.filter((entry) => entry.ship != null);
  if (ships.length === 0) return [entries.slice(0, half), entries.slice(half)];
  const rest = entries.filter((entry) => entry.ship == null);
  const need = Math.max(0, entries.length - half - ships.length);
  return [rest.slice(0, rest.length - need), [...ships, ...rest.slice(rest.length - need)]];
}

/**
 * Two stacked rows (user request, 2026-10-29: keep 44 pt targets where one row would squeeze under them): the front row whole, the
 * back row showing a 44 pt band of its top above it, both of the largest card that leaves the front row's foot at most `HAND_TUCK`
 * under the hand's strip; none when that card is under a 44 pt target or a row would still squeeze a step under one. The band is the
 * room down to a gap above the hand, so the stack reaches that gap and the tuck.
 */
function stacked(entries: readonly ZoneEntry[], width: number, card: { w: number; h: number }, band: number, m: Metrics): PlayPlan | null {
  const target = touch(m.scale, MIN_TARGET);
  const rows = stackedRows(entries);
  const front = rows[1] as ZoneEntry[];
  const room = band + m.gap + HAND_TUCK * m.scale - target - m.peek * deepestUnder(front);
  const w = Math.min(card.w, Math.floor(room / ASPECT));
  if (w < target) return null;
  const size = { w, h: Math.round(w * ASPECT) };
  if (rows.some((row) => rowStep(row, size, width, m) < target)) return null;
  return { size, rows, h: target + size.h + m.peek * deepestUnder(front), pitch: target };
}

/**
 * The play area in a band `band` tall (its own row's room plus the spare under it): the table's card in as many rows as it needs
 * when they fit; one row of it when the squeeze is slight; else the largest smaller card, down to PLAY_FLOOR of it and a 44 pt
 * target, whose rows fit; else the overlaps below.
 */
export function playPlan(entries: readonly ZoneEntry[], width: number, card: { w: number; h: number }, oneRow: number, band: number, m: Metrics): PlayPlan {
  const squeezed: PlayPlan = { size: card, rows: [entries], h: oneRow };
  const full = playRows(entries, card, width, m);
  if (full.length <= 1) return squeezed;
  if (rowsHeight(full, card, m) <= band) return { size: card, rows: full, h: Math.max(oneRow, rowsHeight(full, card, m)) };
  // A slight squeeze (each card overlapping its neighbour by a fifth of a card at most, every step still a target) keeps the table's
  // card: a play area that changes size for a point or two each time a card exhausts reads as a mistake.
  const natural = playWidths(entries, card, m).reduce((sum, w) => sum + w, 0) + m.gap * (entries.length - 1);
  const overlap = (natural - width) / (entries.length - 1);
  if (overlap <= card.w * SLIGHT_SQUEEZE && card.w + m.gap - overlap >= touch(m.scale, MIN_TARGET)) return squeezed;
  const floor = Math.max(Math.round(card.w * PLAY_FLOOR), touch(m.scale, MIN_TARGET));
  for (let w = card.w - 1; w >= floor; w -= 1) {
    const size = { w, h: Math.round(w * ASPECT) };
    const rows = playRows(entries, size, width, m);
    if (rowsHeight(rows, size, m) <= band) return { size, rows, h: Math.max(oneRow, rowsHeight(rows, size, m)) };
  }
  // Under the floor the cards overlap: one row at the floor's size while every step is still a target (so the play area does not
  // grow back to the table's card as one more card comes in), or two stacked rows, whichever has the larger card; else one row of
  // the table's card, squeezed, as before.
  const small = { w: floor, h: Math.round(floor * ASPECT) };
  const tight: PlayPlan | null = rowStep(entries, small, width, m) >= touch(m.scale, MIN_TARGET) ? { size: small, rows: [entries], h: oneRow } : null;
  const stack = stacked(entries, width, card, band, m);
  if (tight && (!stack || tight.size.w >= stack.size.w)) return tight;
  return stack ?? squeezed;
}

// The play area, row under row (stacked rows a 44 pt band apart, the later one in front); a row that does not fit (the squeezed
// fallback) overlaps its cards as staging does. A back row's cards say where the front row starts (`coveredFrom`), so their tokens
// are drawn in the band that shows.
export function placePlay(plan: PlayPlan, area: Rect, out: CardSlot[], m: Metrics): void {
  let y = area.y;
  plan.rows.forEach((row, index) => {
    const next = y + (plan.pitch ?? rowDepth(row, plan.size, m) + m.gap);
    const covers = plan.pitch != null && index < plan.rows.length - 1;
    const xs = rowXs(playWidths(row, plan.size, m), area.x, area.w, m.gap);
    row.forEach((entry, at) => {
      const rect = cardRect(entry.card, xs[at] ?? area.x, y, plan.size);
      // The part of a back-row card the next card in its row leaves visible, for its effect pills.
      const nextX = xs[at + 1];
      const covered = covers ? { coveredFrom: next, coveredStep: nextX == null ? rect.w : Math.min(rect.w, nextX - rect.x) } : {};
      placeUnder(entry, "play", rect, out, [], m.peek);
      // A committed character stands a step higher, sent toward the quest.
      const lift = entry.card.committed ? -m.peek / 2 : 0;
      // An exhausted card is turned about its center, which leaves its top lower than its row's: in a back row it rises by the difference, so the band that shows above the front row is the 44 pt the row keeps, with room for its tokens.
      const turned = covers && isExhausted(entry.card) ? -(plan.size.h - plan.size.w) / 2 : 0;
      out.push({ ...slotOf(entry.card, "play", "card", { ...rect, y: rect.y + lift + turned }), ...covered });
    });
    y = next;
  });
}

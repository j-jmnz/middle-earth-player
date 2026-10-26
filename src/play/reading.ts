// The one reading layer over the table (phase 21): the threat panel (a tap on a dial), the phase carousel (the rail), the table
// settings (the menu's row), a discard pile's list and this round's log. One at a time: opening one replaces the last. The
// carousel and the panels close on a tap outside; Back closes it before it folds the tray (back.ts).
import type { PileId } from "./selectors.ts";

export type Reading = { kind: "threat"; seat: number } | { kind: "carousel" } | { kind: "settings" } | { kind: "pile"; pile: PileId } | { kind: "log" };

/** What a request to open `next` leaves open. The rail toggles: a second tap on it closes the strip. */
export function openReading(now: Reading | null, next: Reading): Reading | null {
  if (now?.kind === "carousel" && next.kind === "carousel") return null;
  return next;
}

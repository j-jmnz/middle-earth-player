// The one reading layer over the table (phase 21): the threat panel (a tap on a dial), the cards that make up the staging threat (a tap on the quest meter), the Island Map (the chip beside the dials), the phase carousel (the rail), the table
// settings (the menu's row), a discard pile's list, the victory display's list, a row's list (the fold stack, row-fold.ts) and this round's log. One at a time: opening one replaces the last. The
// carousel and the panels close on a tap outside; Back closes it before it folds the tray (back.ts).
import type { PileId } from "../store/selectors.ts";

export type Reading = { kind: "threat"; seat: number } | { kind: "carousel" } | { kind: "settings" } | { kind: "pile"; pile: PileId } | { kind: "row"; row: "staging" | "engaged" } | { kind: "log" } | { kind: "island" } | { kind: "stagingThreat" };

/** What a request to open `next` leaves open. The rail toggles: a second tap on it closes the strip. */
export function openReading(now: Reading | null, next: Reading): Reading | null {
  if (now?.kind === "carousel" && next.kind === "carousel") return null;
  return next;
}

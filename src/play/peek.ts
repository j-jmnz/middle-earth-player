// The peek (docs/design-system-table.md; phase 26): in two-handed play the player taps the dial of the seat that is not shown to see
// that seat's whole area (hand, play area, engaged enemies, deck and discard pile). Both hands are one player's, so this hides
// nothing (docs/brief.md, Table). Pure, and not engine state: the store keeps a UI-only `viewedSeat` (store.ts) that is never in the
// save, and who acts never changes by a peek. Whatever picks, pays or sends reads `actingSeat` (selectors.ts); only what is drawn
// reads `shownSeat`.
import type { ScenarioState } from "../rules/core/state.ts";

import { actingSeat, shownSeat } from "./selectors.ts";
import type { TableHighlight } from "./table-canvas-types.ts";

/**
 * The seat a peek at `seat` shows: null for no seat, a seat outside the game, the acting seat (the table shows it already, so
 * a peek at it is the way back) and a solo game, which has one dial and no peek.
 */
export function peekSeat(game: ScenarioState, seat: number | null): number | null {
  if (seat == null || game.seatCount < 2 || seat < 0 || seat >= game.seatCount) return null;
  return seat === actingSeat(game) ? null : seat;
}

/** What a tap on a seat's dial does: it opens that seat's threat panel (the seat is shown), or peeks (`seat` null is the way back). */
export type DialTap = { kind: "panel" } | { kind: "peek"; seat: number | null };

export function dialTap(game: ScenarioState, viewed: number | null, tapped: number): DialTap {
  if (game.seatCount < 2 || tapped === shownSeat(game, viewed)) return { kind: "panel" };
  return { kind: "peek", seat: peekSeat(game, tapped) };
}

export type DialRole = "acting" | "viewing" | null;

/**
 * How a dial reads in two-handed play: the acting seat's is "acting" (its label stays accent), the seat peeked at is "viewing" (a bone
 * ring and an eye mark), any other none. A dial that is not shown says what a tap does ("Shows Player 2's cards", "Shows Player 2's area" once stage 2B
 * has split the table); the shown one, and a solo dial, keep their own hint (null).
 */
export function seatDial(count: number, acting: number, viewed: number | null, seat: number, areas?: boolean): { role: DialRole; hint: string | null } {
  if (count < 2) return { role: null, hint: null };
  const shown = viewed ?? acting;
  return { role: seat === acting ? "acting" : seat === viewed ? "viewing" : null, hint: seat === shown ? null : `Shows Player ${seat + 1}'s ${areas ? "area" : "cards"}` };
}

/** A dial's screen reader name with its role: "Player 1 threat, acting", "Player 2 threat, viewing". */
export function dialName(name: string, role: DialRole): string {
  return role ? `${name}, ${role}` : name;
}

export type PeekWords = { text: string; back: string };

/** The banner over the canvas while peeking, and its way back; null when the table shows the acting seat. */
export function peekWords(game: ScenarioState, viewed: number | null): PeekWords | null {
  const seat = peekSeat(game, viewed);
  if (seat == null) return null;
  const acting = actingSeat(game);
  const out = game.seats[seat]?.eliminated === true;
  return { text: out ? `Player ${seat + 1} is out of the game` : `Viewing Player ${seat + 1} · Player ${acting + 1} is acting`, back: `Back to Player ${acting + 1}` };
}

/** What the canvas marks while peeking: nothing glows, picks nothing and dims nothing (a tap on any card only opens its preview). The canvas also shows no banner beat while peeking (table-canvas.native.tsx). */
export const NO_HIGHLIGHT: TableHighlight = { tappable: new Set(), picked: new Map(), share: null, dimOthers: false, marks: new Map(), muted: new Set(), keep: new Set() };

/** The ids the canvas may lift to drag while peeking: none, so drag-to-play is off. */
export const NO_DRAG: readonly string[] = [];

/** The drop targets of a card being dragged while peeking: none. */
export const NO_TARGETS: readonly never[] = [];

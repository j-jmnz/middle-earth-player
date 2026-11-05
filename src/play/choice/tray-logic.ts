// The choice's pure half (docs/design-system-table.md, Choice tray; phase 21): the rows of a sheet, the count the dock's title speaks,
// the command column's box (the width the rows and the reading panels share), and what a tap outside it does. The component is
// choice/tray.tsx, drawn inside the dock; the hook that holds the fold is use-table-choice.ts.
import { successWords } from "../words/sea.ts";
import type { Choice } from "./table-choice.ts";
import type { PlaceMark } from "../store/island-place.ts";
import type { OptionMark, Sheet, SheetStat } from "./sheet-types.ts";

export type TrayTile = {
  id: string;
  label: string;
  // The catalog code of the card picture, or null (an either/or of an effect has none).
  code: string | null;
  // The card a long press shows large, or null when the option is no card on the table.
  readId: string | null;
  detail: string | null;
  stats: readonly SheetStat[];
  // The damage a defender would take, as a pill.
  mark: OptionMark | null;
  // A location of the Island Map: its place, drawn as a 5 × 3 glyph with the location lit (island-place.ts).
  place?: PlaceMark;
  // A card a Sailing test looked at, listed read-only (`sheet-look-<id>`): the symbols it prints. Absent on an option that can be picked.
  look?: number;
};

/** The tiles of a sheet: each option; a trigger by its ability, with its timing and printed line. */
export function trayTiles(sheet: Sheet): TrayTile[] {
  // A Sailing test's answer lists the cards it looked at, none of them a choice (sea-sheets.ts).
  if (sheet.kind === "pick" && sheet.look != null) return sheet.look.map((row) => ({
      id: row.id,
      label: row.name,
      code: row.code,
      readId: row.id,
      detail: row.success > 0 ? successWords(row.success) : null,
      stats: row.success > 0 ? [{ icon: "sailingSuccess" as const, value: row.success, word: "Success" }] : [],
      mark: null,
      look: row.success,
    }));
  switch (sheet.kind) {
    case "pick":
    case "multi":
    case "distribute":
      return sheet.options.map((item) => ({
        id: item.id,
        label: item.label,
        code: item.code,
        readId: item.code ? item.id : null,
        detail: null,
        stats: item.stats ?? [],
        mark: item.mark ?? null,
        ...(item.place ? { place: item.place } : {}),
      }));
    case "trigger":
      return sheet.options.map((item) => ({ id: item.id, label: `${item.label} · ${item.timing}`, code: item.code, readId: item.cardId, detail: item.text, stats: [], mark: null }));
    case "window":
    case "outcome":
      return [];
  }
}

/** What a tap on a tile does: a card a Sailing test looked at is no choice, so it opens the card large ("read"); any other tile picks. */
export function tileAction(tile: Pick<TrayTile, "look">): "read" | "pick" {
  return tile.look != null ? "read" : "pick";
}

// The sheet's verb without its trailing preposition ("Defend with" is "Defend").
export const wordOf = (verb: string): string => verb.replace(/\s+(with|to|on|for)$/i, "");

/** The count the dock's title speaks while the rows are open, led by the moment's verb: "Defend · pick 1 of 6", "Commit · 2 of 4 picked". */
export function trayCount(sheet: Sheet, choice: Choice): string {
  switch (sheet.kind) {
    case "multi":
      return `${wordOf(sheet.verb)} · ${choice.ids.length} of ${sheet.options.length} picked`;
    case "distribute": {
      const given = choice.shares.reduce((sum, share) => sum + share.amount, 0);
      return `${given} of ${sheet.total} given`;
    }
    case "pick":
      if (sheet.look != null) return `${sheet.look.length} ${sheet.look.length === 1 ? "card" : "cards"} looked at`;
      return `${wordOf(sheet.verb)} · ${choice.ids.length > 0 ? `1 of ${sheet.options.length} picked` : `pick 1 of ${sheet.options.length}`}`;
    case "trigger":
      return `${sheet.timing} · ${choice.ids.length > 0 ? `1 of ${sheet.options.length} picked` : `pick 1 of ${sheet.options.length}`}`;
    case "window":
    case "outcome":
      return "";
  }
}

/**
 * A Response the player may use opens listed on paper, beside the dock's Pass, even when its cards are on the table (user
 * request, 2026-10-29): the player sees what can answer without looking for a glow.
 */
export function listsResponses(sheet: Sheet, windowKind: string | null | undefined): boolean {
  return sheet.kind === "trigger" && windowKind === "response" && sheet.options.length > 0;
}

/** The tray is open when the choice is on paper and its sheet is not the one the player folded. */
export function trayOpen(onPaper: boolean, foldedKey: string | null, sheetKey: string): boolean {
  return onPaper && foldedKey !== sheetKey;
}

/**
 * Where a tap on the canvas (or a drop) goes while the choice is on paper: with the tray open it folds it and goes no further, so
 * it picks nothing, opens no pile and sends no intent; with a screen reader on (the tray is the default and every choice stays a
 * control) or no tray open it is routed as usual: a pile's list, or a pick for the open moment. While the table peeks at the other
 * seat a card is never picked: it only opens its preview (`peeking`). A card of the open sheet (`answers`: it glows on the table while
 * the tray lists it) is picked from the table too, so its glow still works with the tray open.
 */
export function tapRoute(state: { panelOpen: boolean; reader: boolean; cardId: string; peeking?: boolean; answers?: boolean }): "fold" | "pile" | "preview" | "pick" {
  if (state.panelOpen && !state.reader && !(state.answers && !state.peeking)) return "fold";
  if (state.cardId.startsWith("pile:") || state.cardId.startsWith("fold:")) return "pile";
  return state.peeking ? "preview" : "pick";
}

/**
 * What a tap on the canvas does, from its route and, for a pick, whether the table took it (`pick` is the hook's: it picks, or opens
 * the question the card leads to, and says whether it did). While the table peeks at the other seat a card is never picked: `pick` is
 * not called and the card only opens its preview (a face-down card shows nothing).
 */
export type TapAction = "fold" | "pile" | "picked" | "preview" | "none";

export function tapAction(state: { panelOpen: boolean; reader: boolean; cardId: string; peeking: boolean; faceDown: boolean; answers?: boolean }, pick: (cardId: string) => boolean): TapAction {
  const route = tapRoute(state);
  if (route === "fold" || route === "pile") return route;
  if (route === "pick" && pick(state.cardId)) return "picked";
  return state.faceDown ? "none" : "preview";
}

/** The hit layers over the top bar and the command column that fold the open tray: only while it shows, and no reading layer or screen reader is up. */
export function outsideLayers(a: { trayShown: boolean; reading: boolean; reader: boolean }): boolean {
  return a.trayShown && !a.reading && !a.reader;
}

export const TRAY_MAX = 340;
// The shortest the box is, so a tall dock never leaves a box that is not there.
const MIN_HEIGHT = 72;
// The command column's side padding (table/view.tsx, px-2): the dock stands this far inside it, and so do the panels.
export const COLUMN_PAD = 8;

export type TrayBox = { width: number; right: number; bottom: number; maxHeight: number };

/**
 * The command column's box for what stands in it over the table: the column less its padding, at most TRAY_MAX, with its right edge at
 * the column's, so it never reaches into the canvas and covers neither encounter pile (the discard stands 8 pt from the canvas's edge:
 * tray-logic.test.ts checks it against the layout). The reading panels take their width from it. Its foot is `anchorTop` (the screen y
 * of the top of the dock's content), and it is as tall as the room between the top bar and that, never under MIN_HEIGHT. `scale` is
 * the UI scale.
 */
export function trayBox(a: { commandWidth: number; insetRight: number; screenHeight: number; barBottom: number; anchorTop: number }, scale = 1): TrayBox {
  // The tray's own sizes are Medium's, drawn at the UI scale (ui-scale.ts); the insets and the anchors are screen points already.
  const width = Math.min(TRAY_MAX * scale, a.commandWidth - 2 * COLUMN_PAD * scale);
  const foot = Math.max(a.anchorTop, a.barBottom + MIN_HEIGHT * scale);
  return { width, right: a.insetRight + COLUMN_PAD * scale, bottom: Math.round(a.screenHeight - foot), maxHeight: Math.round(foot - a.barBottom) };
}

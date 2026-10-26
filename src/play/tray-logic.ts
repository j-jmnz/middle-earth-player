// The choice tray's pure half (docs/design-system.md, Table, Choice tray; phase 21): the tiles of a sheet, the muted count at
// the tray's top, where the tray sits against the command column and the dock, and what a tap outside it does. The component is
// choice-tray.tsx; the hook that holds the fold is use-table-choice.ts.
import type { Choice } from "./table-choice.ts";
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
};

/** The tiles of a sheet: each option; a trigger by its ability, with its timing and printed line. */
export function trayTiles(sheet: Sheet): TrayTile[] {
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
      }));
    case "trigger":
      return sheet.options.map((item) => ({ id: item.id, label: `${item.label} · ${item.timing}`, code: item.code, readId: item.cardId, detail: item.text, stats: [], mark: null }));
    case "window":
    case "outcome":
      return [];
  }
}

/** The muted count at the tray's top: how many are picked, or what to do when nothing is. */
export function trayCount(sheet: Sheet, choice: Choice): string {
  switch (sheet.kind) {
    case "multi":
      return `${choice.ids.length} of ${sheet.options.length} picked`;
    case "distribute": {
      const given = choice.shares.reduce((sum, share) => sum + share.amount, 0);
      return `${given} of ${sheet.total} given`;
    }
    case "pick":
    case "trigger":
      return choice.ids.length > 0 ? "1 picked" : `Pick one of ${sheet.options.length}`;
    case "window":
    case "outcome":
      return "";
  }
}

/** The tray is open when the choice is on paper and its sheet is not the one the player folded. */
export function trayOpen(onPaper: boolean, foldedKey: string | null, sheetKey: string): boolean {
  return onPaper && foldedKey !== sheetKey;
}

/**
 * A tap that landed outside the open tray (the canvas, the top bar, the empty part of the command column): it folds the tray
 * and goes no further, or, with a screen reader on (the tray is the default and every choice stays a control), it is not
 * taken at all and the tap is routed as usual.
 */
export function outsideTap(state: { panelOpen: boolean; reader: boolean }): "fold" | "route" {
  return state.panelOpen && !state.reader ? "fold" : "route";
}

export const TRAY_MAX = 340;
// How far into the canvas the tray reaches past the command column.
export const TRAY_REACH = 40;
const GAP = 4;

export type TrayBox = { width: number; right: number; bottom: number; maxHeight: number; overlap: number };

/**
 * Where the tray sits: the command column's width plus up to TRAY_REACH into the canvas (at most TRAY_MAX), its right edge at
 * the column's, its foot GAP above `anchorTop` (the screen y of the top of the dock's block of readout, armed line and
 * buttons, which it never covers), and as tall as the room between the top bar and that. Null until the dock is measured.
 */
export function trayBox(a: { commandWidth: number; insetRight: number; screenHeight: number; barBottom: number; anchorTop: number | null }): TrayBox | null {
  if (a.anchorTop == null || a.anchorTop <= a.barBottom + GAP) return null;
  const width = Math.min(TRAY_MAX, a.commandWidth + TRAY_REACH);
  return { width, right: a.insetRight, bottom: Math.round(a.screenHeight - a.anchorTop + GAP), maxHeight: Math.round(a.anchorTop - GAP - a.barBottom), overlap: width - a.commandWidth };
}

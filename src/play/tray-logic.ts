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

// The sheet's verb without its trailing preposition ("Defend with" is "Defend").
const wordOf = (verb: string): string => verb.replace(/\s+(with|to|on|for)$/i, "");

/** The muted count at the tray's top, led by the moment's verb: "Defend · pick 1 of 6", "Commit · 2 of 4 picked". */
export function trayCount(sheet: Sheet, choice: Choice): string {
  switch (sheet.kind) {
    case "multi":
      return `${wordOf(sheet.verb)} · ${choice.ids.length} of ${sheet.options.length} picked`;
    case "distribute": {
      const given = choice.shares.reduce((sum, share) => sum + share.amount, 0);
      return `${given} of ${sheet.total} given`;
    }
    case "pick":
      return `${wordOf(sheet.verb)} · ${choice.ids.length > 0 ? `1 of ${sheet.options.length} picked` : `pick 1 of ${sheet.options.length}`}`;
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
 * Where a tap on the canvas (or a drop) goes while the choice is on paper: with the tray open it folds it and goes no further, so
 * it picks nothing, opens no pile and sends no intent; with a screen reader on (the tray is the default and every choice stays a
 * control) or no tray open it is routed as usual: a pile's list, or a pick for the open moment.
 */
export function tapRoute(state: { panelOpen: boolean; reader: boolean; cardId: string }): "fold" | "pile" | "pick" {
  if (state.panelOpen && !state.reader) return "fold";
  return state.cardId.startsWith("pile:") ? "pile" : "pick";
}

/** The hit layers over the top bar and the command column that fold the open tray: only while it shows, and no reading layer or screen reader is up. */
export function outsideLayers(a: { trayShown: boolean; reading: boolean; reader: boolean }): boolean {
  return a.trayShown && !a.reading && !a.reader;
}

export const TRAY_MAX = 340;
// The most the tray reaches into the canvas past the command column, on a screen wide enough to spare it, and the clearance it
// keeps from the encounter pile it would otherwise cover. The reach is clamped to that pile (`reachInto`): the discard stands 8 pt
// from the canvas's right edge, so on today's layout the reach is 0 and the tray is the command column's width. Reserving the
// reach in the canvas's gutter instead shrinks the cards (tray-logic.test.ts measures it), so the reach gives way.
export const TRAY_REACH = 40;
export const PILE_CLEAR = 8;
export const WIDE = 720;
// The shortest the tray is drawn, so a tall dock never leaves a tray that is not there.
const MIN_HEIGHT = 72;
const GAP = 4;

/**
 * How far the tray reaches into the canvas: at most TRAY_REACH on a screen WIDE or wider, and stopping PILE_CLEAR short of the
 * rightmost pile's near edge. `pileGap` is the distance from the canvas's right edge to that edge (`encounterPiles` in layout.ts),
 * so the tray never covers the encounter deck or discard; it may be 0.
 */
export function reachInto(screenWidth: number, pileGap: number): number {
  return screenWidth >= WIDE ? Math.max(0, Math.min(TRAY_REACH, pileGap - PILE_CLEAR)) : 0;
}

export type TrayBox = { width: number; right: number; bottom: number; maxHeight: number; overlap: number };

/**
 * Where the tray sits: the command column's width plus `reachInto` the canvas on a screen WIDE or wider (at most TRAY_MAX),
 * its right edge at the column's, its foot GAP above `anchorTop` (the screen y of the top of the dock's block of readout, armed
 * line and buttons, which it never covers), and as tall as the room between the top bar and that, never under MIN_HEIGHT.
 */
export function trayBox(a: { commandWidth: number; insetRight: number; screenWidth: number; screenHeight: number; barBottom: number; anchorTop: number; pileGap: number }): TrayBox {
  const reach = reachInto(a.screenWidth, a.pileGap);
  const width = Math.min(TRAY_MAX, a.commandWidth + reach);
  const foot = Math.max(a.anchorTop - GAP, a.barBottom + MIN_HEIGHT);
  return { width, right: a.insetRight, bottom: Math.round(a.screenHeight - foot), maxHeight: Math.round(foot - a.barBottom), overlap: width - a.commandWidth };
}

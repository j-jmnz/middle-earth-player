// The choice's pure half (docs/design-system-table.md, Choice tray; phase 21): the rows of a sheet, the count the dock's title speaks,
// the command column's box (the width the rows and the reading panels share), and what a tap outside it does. The component is
// choice/tray.tsx, drawn inside the dock; the hook that holds the fold is use-table-choice.ts.
import { successWords } from "../words/scenarios/sea.ts";
import { shareOf, shareSum, type Share } from "./pay.ts";
import { choiceFor, type Choice } from "./table-choice.ts";
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

/**
 * The role a screen reader gives a row of the open tray (docs/design-system-table.md, Screen reader): a pick is one of several to choose
 * from (radio), a multi a set to tick (checkbox), a trigger a thing to use (button), a share an amount to raise or lower (adjustable). A
 * card a Sailing test looked at is listed to read, a button. Said only under useReaderMode.
 */
export type TileRole = "radio" | "checkbox" | "button" | "adjustable";

export function tileRole(sheet: Sheet): TileRole {
  switch (sheet.kind) {
    case "pick":
      return sheet.look != null ? "button" : "radio";
    case "multi":
      return "checkbox";
    case "distribute":
      return "adjustable";
    case "trigger":
    case "window":
    case "outcome":
      return "button";
  }
}

/** The state a row of that role speaks: a radio or a checkbox is checked, any other is selected. */
export function tileState(role: TileRole, selected: boolean): { checked: boolean } | { selected: boolean } {
  return role === "radio" || role === "checkbox" ? { checked: selected } : { selected };
}

/** The most one recipient of a distribute sheet can take: its own pool, and for a fixed total no more than the total. */
export function shareCap(sheet: Extract<Sheet, { kind: "distribute" }>, id: string): number {
  const item = sheet.options.find((candidate) => candidate.id === id);
  if (!item) return 0;
  return sheet.exact ? Math.min(item.max, sheet.total) : item.max;
}

/**
 * What a share row speaks as its value: the row's share and its cap, then the running total ("Pays 1, up to 2. 1 of 3 paid in all"; archery
 * damage: "Takes 1, up to 3. 2 of 4 assigned"). A total that need not be met (an X cost) has no "of": "1 paid in all".
 */
export function shareValue(sheet: Extract<Sheet, { kind: "distribute" }>, shares: readonly Share[], id: string): { now: number; max: number; text: string } {
  const now = shareOf(shares, id);
  const max = shareCap(sheet, id);
  const sum = shareSum(shares);
  const archery = sheet.purpose.kind === "archery";
  const all = archery ? (sheet.exact ? `${sum} of ${sheet.total} assigned` : `${sum} assigned in all`) : sheet.exact ? `${sum} of ${sheet.total} paid in all` : `${sum} paid in all`;
  return { now, max, text: `${archery ? "Takes" : "Pays"} ${now}, up to ${max}. ${all}` };
}

/**
 * What a double tap on a share row does: it adds one share; at the row's cap, or when the total is met, it takes them back (tapShare goes
 * round to none). A row with none to take back when the total is met says so.
 */
export function shareHint(sheet: Extract<Sheet, { kind: "distribute" }>, shares: readonly Share[], id: string): string {
  const now = shareOf(shares, id);
  const full = sheet.exact && shareSum(shares) >= sheet.total;
  if (now === 0 && (full || shareCap(sheet, id) === 0)) return "Nothing more can be added here";
  return now >= shareCap(sheet, id) || full ? "Double tap to take them back" : "Double tap to add one";
}

/**
 * One share more (`delta` 1) or less (-1) for a recipient, from an increment or decrement action of a screen reader. Unlike a tap, which
 * goes round to none at its cap, an action stops at the ends: it adds while the recipient is under its cap and, for a fixed total, while
 * the total is not met, and takes one away only while it holds one. Returns the same list when nothing moves.
 */
export function stepShares(shares: readonly Share[], id: string, cap: number, total: number | null, delta: 1 | -1): readonly Share[] {
  const current = shareOf(shares, id);
  const next = delta === 1 ? (current >= cap || (total != null && shareSum(shares) >= total) ? current : current + 1) : Math.max(0, current - 1);
  if (next === current) return shares;
  const rest = shares.filter((share) => share.id !== id);
  return next > 0 ? [...rest, { id, amount: next }] : rest;
}

/** The choice after an increment or decrement action on a distribute row, or null when the row does not exist or nothing moves. */
export function stepChoice(sheet: Sheet, held: Choice | null, id: string, delta: 1 | -1): Choice | null {
  if (sheet.kind !== "distribute") return null;
  const choice = choiceFor(sheet, held);
  const shares = stepShares(choice.shares, id, shareCap(sheet, id), sheet.exact ? sheet.total : null, delta);
  return shares === choice.shares ? null : { ...choice, shares };
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

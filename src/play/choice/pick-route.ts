// Two decisions of the table's choice hook (use-table-choice.ts) as pure functions, so the reader parity test (src/play/reader-play.test.ts)
// asks the same questions the hook does: whether the open sheet is listed on paper, and what a pick on a card or a row does.
import { tappable, tap, primaryReady, type Choice, type Dock, type TapContext, type TapResult } from "./table-choice.ts";
import type { Sheet } from "./sheet-types.ts";

/**
 * True when the sheet is listed on paper whatever its cards are: the player asked (`asked`: a sheet opened as a panel, or List), a Response the
 * player may use (`responses`, listsResponses), or a screen reader is on (`reader`), where a card drawn only on the canvas is no control: every
 * pick, multi, distribute and trigger sheet with a choice (`choices` is how many cards it asks about), and a Sailing test's look (`looks`).
 * Primitives only: the hook calls it every render with values it already has.
 */
export function listedOnPaper(asked: boolean, responses: boolean, reader: boolean, kind: Sheet["kind"], choices: number, looks: boolean): boolean {
  return asked || responses || (reader && kind !== "window" && kind !== "outcome" && choices > 0) || (reader && kind === "pick" && looks);
}

/** What a pick of a card or a tray row does: press the dock's primary when the moment has one answer, else the tap's result (table-choice.ts, tap). */
export type PickResult = { kind: "primary" } | TapResult;

export function pickResult(sheet: Sheet, held: Choice | null, id: string, table: TapContext, dock: Dock): PickResult {
  // The only answer of the moment: the pick on its card sends it.
  if (dock.single && dock.primary && primaryReady(dock) && tappable(sheet).has(id)) return { kind: "primary" };
  return tap(sheet, held, id, table);
}

// Rules: brief, Rules engine, Undo. The feedback of one Undo tap, shared by the table's dock and the result screens' "Undo last move"
// (src/screens/table/result-undo.tsx): the Sent tick and Undo's sound play when there is a move to take back, before the store does
// the work, so the tap answers at once. The table adds its own reset after it (the reader's touched card, the open sheet).
import { tickSent } from "../../ui/haptics.ts";
import { playUndo } from "../../ui/sound/sound.ts";
import type { TableStore } from "../store/store.ts";

/** Takes the last move back with the tick and the sound. False, and silent, when there is nothing to take back. */
export function undoWithFeedback(store: TableStore): boolean {
  if (store.getState().history.length === 0) return false;
  tickSent();
  playUndo();
  return store.getState().undo();
}

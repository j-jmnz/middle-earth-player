// Undo on a result screen (the Resolution, a standalone game's outcome). The move that ended the game can be taken back like
// any other (docs/architecture.md, State): the button goes back one move through the same store the table uses, with the table's
// tick and sound (undoWithFeedback), and `onUndone` runs once it has. Shown only while there is a move to take back, or an
// unconfirmed pick to put back first (docs/brief.md, Rules engine: "While a pick is being made, Undo puts back the pick first").
import { useStore } from "zustand";

import { undoWithFeedback } from "../../play/choice/undo-feedback";
import type { TableStore } from "../../play/store/store";
import { TextButton } from "../kit/chrome";

export function ResultUndo({ store, testID, onUndone, picking, onPutBack }: { store: TableStore; testID: string; onUndone: () => void; picking?: boolean; onPutBack?: () => void }) {
  const canUndo = useStore(store, (state) => state.history.length > 0);
  const putting = picking === true && onPutBack != null;
  if (!canUndo && !putting) return null;
  const undo = () => {
    // A pick being made goes back first and takes no move back (the table's dock does the same).
    if (putting) {
      onPutBack();
      return;
    }
    if (undoWithFeedback(store)) onUndone();
  };
  // The sound is Undo's own (undoWithFeedback plays it with the tick), not the button's click.
  return <TextButton label="Undo last move" testID={testID} tone="muted" sound={null} accessibilityHint={putting ? "Puts back this pick" : "Takes back your last choice"} onPress={undo} />;
}

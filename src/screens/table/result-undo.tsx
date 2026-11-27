// Undo on a result screen (the Resolution, a standalone game's outcome). The move that ended the game can be taken back like
// any other (docs/architecture.md, State): the button goes back one move through the same store the table uses, with the table's
// tick and sound, and `onUndone` leaves the screen once the game is on again. Shown only while there is a move to take back.
import { useStore } from "zustand";

import type { TableStore } from "../../play/store/store";
import { tickSent } from "../../ui/haptics";
import { playUndo } from "../../ui/sound/sound";
import { TextButton } from "../kit/chrome";

export function ResultUndo({ store, testID, onUndone }: { store: TableStore; testID: string; onUndone: () => void }) {
  const canUndo = useStore(store, (state) => state.history.length > 0);
  if (!canUndo) return null;
  const undo = () => {
    tickSent();
    playUndo();
    if (store.getState().undo()) onUndone();
  };
  return <TextButton label="Undo last move" testID={testID} accessibilityHint="Takes back your last choice" onPress={undo} />;
}

import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import type { Save } from "../../campaign/save";
import { readSaveChecked, writeSave } from "./campaign-store";
import { useDatabases } from "./databases";

export function droppedSentence(): string {
  return "The scenario in progress could not be read, so it was dropped. Your log and decks are kept.";
}

/**
 * One save of user.db, read again each time the screen comes into focus. An open scenario that does not read at all is dropped
 * on the read (the log, the decks and the image index stay) and `dropped` says so. One from another engine version or against
 * other card data is left as it is: the table asks the player to continue it or restart it (session/table-open.ts).
 */
export function useSave(saveId: string | undefined): { save: Save | null; loaded: boolean; dropped: boolean; update: (next: Save) => void } {
  const { user } = useDatabases();
  const [state, setState] = useState<{ save: Save | null; loaded: boolean; dropped: boolean }>({ save: null, loaded: false, dropped: false });
  useFocusEffect(
    useCallback(() => {
      const read = saveId ? readSaveChecked(user, saveId) : null;
      const save = read?.save ?? null;
      const dropped = read?.unreadable === true;
      if (save && dropped) writeSave(user, save);
      setState((current) => ({ save, loaded: true, dropped: dropped || current.dropped }));
    }, [saveId, user]),
  );
  const update = useCallback(
    (next: Save) => {
      writeSave(user, next);
      setState((current) => ({ ...current, save: next, loaded: true }));
    },
    [user],
  );
  return { save: state.save, loaded: state.loaded, dropped: state.dropped, update };
}

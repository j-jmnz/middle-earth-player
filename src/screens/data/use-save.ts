import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import type { Save } from "../../campaign/save";
import { drop, staleReason } from "../../campaign/session";
import { CATALOG_VERSION } from "../../catalog/version";
import { readSaveChecked, writeSave } from "./campaign-store";
import { useDatabases } from "./databases";

export type DropReason = "changed" | "unreadable";

export function droppedSentence(reason: DropReason): string {
  return reason === "changed"
    ? "The scenario in progress was dropped because the rules or the card data changed. Your log and decks are kept."
    : "The scenario in progress could not be read, so it was dropped. Your log and decks are kept.";
}

/**
 * One save of user.db, read again each time the screen comes into focus. An open scenario from another engine version or
 * against other card data is dropped on the read, and so is one that does not read at all; the log, the decks and the image
 * index stay. `dropped` says which.
 */
export function useSave(saveId: string | undefined): { save: Save | null; loaded: boolean; dropped: DropReason | null; update: (next: Save) => void } {
  const { user } = useDatabases();
  const [state, setState] = useState<{ save: Save | null; loaded: boolean; dropped: DropReason | null }>({ save: null, loaded: false, dropped: null });
  useFocusEffect(
    useCallback(() => {
      const read = saveId ? readSaveChecked(user, saveId) : null;
      let save = read?.save ?? null;
      let dropped: DropReason | null = read?.unreadable ? "unreadable" : null;
      if (save?.active && staleReason(save.active, CATALOG_VERSION)) {
        save = drop(save);
        writeSave(user, save);
        dropped = "changed";
      } else if (save && read?.unreadable) {
        writeSave(user, save);
      }
      setState((current) => ({ save, loaded: true, dropped: dropped ?? current.dropped }));
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

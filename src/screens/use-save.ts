import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import type { Save } from "../campaign/save";
import { drop, staleReason } from "../campaign/session";
import { CATALOG_VERSION } from "../catalog/version";
import { readSave, writeSave } from "./campaign-store";
import { useDatabases } from "./databases";

/**
 * One save of user.db, read again each time the screen comes into focus. An open scenario from another engine version or
 * against other card data is dropped on the read, and the log, the decks and the image index stay. `dropped` says so.
 */
export function useSave(saveId: string | undefined): { save: Save | null; loaded: boolean; dropped: boolean; update: (next: Save) => void } {
  const { user } = useDatabases();
  const [state, setState] = useState<{ save: Save | null; loaded: boolean; dropped: boolean }>({ save: null, loaded: false, dropped: false });
  useFocusEffect(
    useCallback(() => {
      let save = saveId ? readSave(user, saveId) : null;
      let dropped = false;
      if (save?.active && staleReason(save.active, CATALOG_VERSION)) {
        save = drop(save);
        writeSave(user, save);
        dropped = true;
      }
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

// Keeps the screen awake while a table is open and the Keep screen awake setting is on (user request, 2026-10-28). Each hold has
// its own tag, so a request that settles after its release (a fast off and on) only ever releases its own lock; it is released
// when the setting turns off and when the table unmounts. A platform without the module (the web) refuses the promise, and
// that is not an error the player should see.
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";
import { useStore } from "zustand";

import { tableSettings } from "../../ui/table-settings.ts";

let holds = 0;

/** Takes the lock under a tag of its own; the returned function releases it, even if the request has not settled yet. */
export function holdAwake(): () => void {
  const tag = `table-${++holds}`;
  let held = true;
  activateKeepAwakeAsync(tag)
    .then(() => {
      if (!held) void Promise.resolve(deactivateKeepAwake(tag)).catch(() => undefined);
    })
    .catch(() => undefined);
  return () => {
    if (!held) return;
    held = false;
    void Promise.resolve(deactivateKeepAwake(tag)).catch(() => undefined);
  };
}

export function useKeepAwake(): void {
  const keepAwake = useStore(tableSettings, (state) => state.settings.keepAwake);
  useEffect(() => (keepAwake ? holdAwake() : undefined), [keepAwake]);
}

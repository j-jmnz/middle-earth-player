// Writes the queued runs when the app leaves the foreground (pending-runs.ts): a run waits for the next paint, and a phone that is
// backgrounded may be killed before it. Bound once, at the first run queued.
import { AppState } from "react-native";

import { flushRuns } from "../data/pending-runs";

let bound = false;

export function flushRunsOnLeave(): void {
  if (bound) return;
  bound = true;
  AppState.addEventListener("change", (state) => {
    if (state === "background" || state === "inactive") flushRuns();
  });
}

// Writes the queued runs when the page is hidden or closed (pending-runs.ts): a run waits for the next paint, and a desktop window that is minimised, a tab that is
// switched away or a window that is closed would otherwise lose the one still waiting. The phone's file (flush-runs-on-leave.native.ts) does the same on AppState.
// Bound once, at the first run queued. The tests have no page to leave: nothing to bind.
import { flushRuns } from "../data/pending-runs";

let bound = false;

export function flushRunsOnLeave(): void {
  if (bound || typeof document === "undefined") return;
  bound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushRuns();
  });
  window.addEventListener("pagehide", flushRuns);
}

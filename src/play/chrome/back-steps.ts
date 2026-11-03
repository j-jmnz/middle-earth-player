// The Back steps the play layer carries out itself (back.ts picks the step; src/screens/table-view.tsx peels the layers it owns, the
// menu, the popovers, the preview, the reading layer, the sheet and the tray): skip a combat spotlight that is playing, cancel an open
// hand scrub, end a peek at the other seat, in that order. True when it handled the step.
import type { BackLayers, BackStep } from "./back.ts";
import { cancelScrub, scrubOpen } from "../canvas/scrub-open.ts";
import { spotlightOpen } from "../spotlight/gate.ts";
import type { TableStore } from "../store/store.ts";
import { peekTo } from "../store/use-peek.ts";

export { backStep } from "./back.ts";

/** The layers of `backStep` the play layer knows by itself: a spotlight playing, a hand scrub open, a peek at the other seat. */
export function playLayers(store: TableStore): Pick<BackLayers, "spotlightOpen" | "scrubOpen" | "peekOpen"> {
  const now = store.getState();
  return { spotlightOpen: spotlightOpen(now.spotlight), scrubOpen: scrubOpen(), peekOpen: now.viewedSeat != null };
}

export function runBackStep(step: BackStep, store: TableStore): boolean {
  if (step === "skipSpotlight") store.getState().endSpotlight("skipped");
  else if (step === "cancelScrub") cancelScrub();
  else if (step === "endPeek") peekTo(store, null);
  else return false;
  return true;
}

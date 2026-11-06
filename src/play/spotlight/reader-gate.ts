// The combat spotlight's gate under the reader table (docs/design-system-table.md, Screen reader). The reader table mounts no canvas, so
// nothing plays a spotlight and nothing would end its gate (use-spotlight.ts does that for the canvas): the table ends it itself, so
// Android Back, the scrim and the banner's wait never hold for an attack nobody draws. Reader mode only.
import { useEffect } from "react";
import { useStore } from "zustand";

import type { TableStore } from "../store/store.ts";
import { spotlightOpen, type SpotlightGate } from "./gate.ts";

/** Whether a reader table ends the gate now: it has attacks and has not ended. */
export function readerGateEnds(gate: SpotlightGate): boolean {
  return spotlightOpen(gate);
}

/** Ends the gate of every moment's attacks as soon as it opens ("skipped": the banner carries the attack). Mount it only in the reader table. */
export function useReaderGateEnd(store: TableStore): void {
  const seq = useStore(store, (state) => state.spotlight.seq);
  const ends = useStore(store, (state) => readerGateEnds(state.spotlight));
  useEffect(() => {
    if (ends) store.getState().endSpotlight("skipped", seq);
  }, [ends, seq, store]);
}

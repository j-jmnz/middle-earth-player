// The peek's hooks and actions (peek.ts, docs/design-system.md, Table; phase 26). The seat peeked at is the table store's `viewedSeat`;
// these read it for the screen, route a dial tap, and end the peek when the moment moves on. Nothing here sends an intent or changes
// who acts: the dock, the picks and the sheets stay the acting seat's.
import { useCallback, useEffect } from "react";
import { useStore } from "zustand";

import { dialTap, peekSeat, peekWords, type PeekWords } from "./peek.ts";
import { cancelScrub, scrubOpen } from "./scrub-open.ts";
import { actingSeat, shownSeat } from "./selectors.ts";
import type { TableStore } from "./store.ts";

/**
 * Peeks at `seat`, or goes back to the acting seat with null. A hand scrub that is open when the shown seat changes is cancelled
 * first: its spread reads the shown seat's hand slots, so it must not be left spread over another seat's hand.
 */
export function peekTo(store: TableStore, seat: number | null): void {
  const { game, viewedSeat } = store.getState();
  if (shownSeat(game, peekSeat(game, seat)) !== shownSeat(game, viewedSeat) && scrubOpen()) cancelScrub();
  store.getState().peek(seat);
}

export type PeekView = {
  // The seat peeked at, or null while the table shows the acting seat.
  viewed: number | null;
  // The seat the table draws, and the seat the engine is asking.
  shown: number;
  acting: number;
  // The banner over the canvas and its way back, or null.
  words: PeekWords | null;
  // A tap on a seat's dial: peeks (true) when that seat is not the one shown; false leaves it to open the threat panel.
  tap: (seat: number) => boolean;
  back: () => void;
};

export function usePeek(store: TableStore): PeekView {
  const game = useStore(store, (state) => state.game);
  const stored = useStore(store, (state) => state.viewedSeat);
  const viewed = peekSeat(game, stored);
  const tap = useCallback(
    (seat: number): boolean => {
      const now = store.getState();
      const action = dialTap(now.game, now.viewedSeat, seat);
      if (action.kind === "panel") return false;
      peekTo(store, action.seat);
      return true;
    },
    [store],
  );
  const back = useCallback(() => peekTo(store, null), [store]);
  return { viewed, shown: shownSeat(game, viewed), acting: actingSeat(game), words: peekWords(game, viewed), tap, back };
}

/**
 * Whether the table is peeking, for the tap that routes a card to its preview. A new sheet key (a sheet the player opened from the
 * table, or the moment's own) ends the peek; so does every new state, which the store does itself (store.ts, `viewedSeat`).
 */
export function usePeeking(store: TableStore, sheetKey: string): boolean {
  useEffect(() => peekTo(store, null), [store, sheetKey]);
  return useStore(store, (state) => state.viewedSeat != null);
}

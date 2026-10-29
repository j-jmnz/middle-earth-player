// When the quest advance screen is up (quest-advance.ts): from the intent that advanced the quest until the player taps Progress, or,
// when the new stage asked a question as it was revealed, until that question is answered. Read during the render the moment arrives
// in, so the table's own answers (use-table-choice.ts, useAutoAnswer) already hold on that render. A combat spotlight plays first.
import { useCallback, useState } from "react";
import { useStore } from "zustand";

import { advancedTo, closeLatch, nextLatch, NO_ADVANCE, openAdvance, stageAsks, type QuestAdvance } from "./quest-advance.ts";
import type { TableStore } from "./store.ts";
import { useSpotlightHold } from "./use-spotlight.ts";

export type QuestAdvanceState = {
  // The advance on screen, or null; `held` is true from the moment it arrives, also while a spotlight plays before it shows.
  shown: QuestAdvance | null;
  held: boolean;
  // The new stage's When Revealed is asking now: the screen shows its question in place of Progress.
  asks: boolean;
  // Progress: back to the table.
  close: () => void;
};

export function useQuestAdvance(store: TableStore): QuestAdvanceState {
  const moment = useStore(store, (state) => state.moment);
  const game = useStore(store, (state) => state.game);
  const spotlit = useSpotlightHold(store);
  const [latch, setLatch] = useState(NO_ADVANCE);
  // Set during render (the derived-state pattern): React renders again before it commits, so no effect sees the old latch.
  const next = nextLatch(latch, advancedTo(moment, game), game);
  if (next !== latch) setLatch(next);
  const open = openAdvance(next, game);
  const close = useCallback(() => setLatch(closeLatch), []);
  return { shown: open && !spotlit ? open : null, held: open != null, asks: open != null && stageAsks(game, open.stageId), close };
}

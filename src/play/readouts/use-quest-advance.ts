// When the quest advance screen is up (quest-advance.ts): from the intent that advanced the quest until the player taps Progress, or,
// when the new stage asked a question as it was revealed, until that question is answered. Read during the render the moment arrives
// in, so the table's own answers (use-table-choice.ts, useAutoAnswer) already hold on that render. A combat spotlight plays first.
// The table opens on it too, at the stage in play (openingLatch).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";

import { isOver } from "../../rules/engine/undo.ts";

import { advancedTo, askingStage, callerLastStage, stagesKey, closeLatch, nextLatch, openAdvance, openingLatch, questStageOf, type QuestAdvance, type QuestView } from "./quest-advance.ts";
import type { TableStore } from "../store/store.ts";
import { useSpotlightHold } from "../spotlight/use-spotlight.ts";
import { playSound } from "../../ui/sound/sound.ts";

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
  // What the screen reads of the game, one value at a time: a state that changes none of them does not render this hook's caller.
  const questStage = useStore(store, (state) => questStageOf(state.game));
  const asking = useStore(store, (state) => askingStage(state.game));
  const over = useStore(store, (state) => isOver(state.game));
  // The stages the seats are on once stages are separate: an advance of any seat's stage holds the screen.
  const seatStages = useStore(store, (state) => stagesKey(state.game));
  // The Stormcaller's stage once it is at its last: its advance there is told on the screen too (quest-advance.ts).
  const callerStage = useStore(store, (state) => callerLastStage(state.game));
  const view = useMemo((): QuestView => ({ questStage, asking, over, seatStages, callerStage }), [questStage, asking, over, seatStages, callerStage]);
  const spotlit = useSpotlightHold(store);
  const [latch, setLatch] = useState(() => openingLatch(view));
  // Set during render (the derived-state pattern): React renders again before it commits, so no effect sees the old latch.
  const next = nextLatch(latch, advancedTo(moment, view), view);
  if (next !== latch) setLatch(next);
  const open = openAdvance(next, view);
  const close = useCallback(() => setLatch(closeLatch), []);
  // The advance's sound plays as its screen shows, once a spotlight before it has ended (docs/design-system-table.md, Sound).
  const showing = open && !spotlit ? open.seq : null;
  useEffect(() => {
    if (showing != null) playSound("dread.stage");
  }, [showing]);
  return { shown: open && !spotlit ? open : null, held: open != null, asks: open != null && view.asking === open.stageId, close };
}

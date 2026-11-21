// The open table's music and the engagement sound (docs/design-system-table.md, Sound), mounted by the table's routes beside the table view: its scenario's calm loop, and its combat loop while a fight is on. A fight
// is an attack resolving or waiting to (in any phase), or the Combat phase with an enemy engaged with a seat; a spotlight still playing
// the last attack keeps it on until the attack has shown. An empty Combat phase stays calm, and a game that has ended plays its calm loop
// under the outcome. Leaving the table hands the music back to the menu's loop (the root layout's route rule, src/screens/nav/route-music.ts).
import { useEffect } from "react";
import { useStore } from "zustand";

import { tableMusic } from "../../ui/sound/music-map.ts";
import { setTableMusic } from "../../ui/sound/music.ts";
import { useSpotlightHold } from "../spotlight/use-spotlight.ts";
import type { TableStore } from "../store/store.ts";
import { combatMusic, newlyEngaged } from "./combat-music.ts";
import { playSound } from "../../ui/sound/sound.ts";
import { useSkippedStrikes } from "../spotlight/strike-play.ts";

/** The table's music, mounted beside the table view by its routes (src/screens/routes/table, standalone/table); it draws nothing. */
export function TableMusic({ store }: { store: TableStore }): null {
  useTableMusic(store);
  // The sounds of the attacks a skipped spotlight did not play (strike-play.ts).
  useSkippedStrikes(store);
  useEngageSound(store);
  return null;
}

// An enemy engaging a seat sounds as the state that engages it is accepted, under reduced motion too; an Undo's restored state is quiet (sound.ts).
function useEngageSound(store: TableStore): void {
  useEffect(() => store.subscribe((state, before) => {
    if (newlyEngaged(before.game, state.game)) playSound("combat.engage");
  }), [store]);
}

export function useTableMusic(store: TableStore): void {
  const scenario = useStore(store, (state) => state.game.scenarioId);
  const fight = useStore(store, (state) => combatMusic(state.game));
  const spotlit = useSpotlightHold(store);
  const loop = tableMusic(scenario, fight || spotlit);
  // Shown again by Activity, the table takes the music back; hidden, it keeps it (a rule or a card page opened over the table).
  useEffect(() => {
    setTableMusic(loop);
  }, [loop]);
}

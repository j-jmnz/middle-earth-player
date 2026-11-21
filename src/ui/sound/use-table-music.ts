// The open table's music (docs/design-system-table.md, Sound): its scenario's calm loop, and its combat loop during the Combat phase.
// A table hidden by Activity or closed hands the music back to the menu's loop; shown again, it takes it back.
import { useEffect } from "react";

import { tableMusic } from "./music-map.ts";
import { setTableMusic } from "./music.ts";

export function useTableMusic(scenarioId: string, combat: boolean): void {
  const loop = tableMusic(scenarioId, combat);
  useEffect(() => {
    setTableMusic(loop);
  }, [loop]);
  useEffect(() => () => setTableMusic(null), []);
}

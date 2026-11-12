// What changed under an open game, in the words a player reads on the table's stale sheet (docs/design-system.md, Table opens stale): the lines of
// ENGINE_CHANGES between the game's engine version and the build's that reach its scenario, and one line when the cards or the scenario changed.
// Pure.
import { changesReaching } from "../rules/engine/version.ts";

import { worldChanged, type ActiveScenario } from "./replay.ts";

export { ENGINE_CHANGES } from "../rules/engine/version.ts";

export const WORLD_CHANGED = "The cards or the scenario changed.";

/** `world` is the worldHash of the world the game opens on, or null where none is built (then only a save with no stamp is compared, on the catalog version). */
export function staleChanges(active: Pick<ActiveScenario, "engineVersion" | "dataHash" | "world">, scenarioId: string, world: number | null): readonly string[] {
  return [...changesReaching(scenarioId, active.engineVersion), ...(worldChanged(active, world) ? [WORLD_CHANGED] : [])];
}

// A card that "cannot leave the staging area" and has not lost that bar (a stage or an effect that removes it sets `losesCannotLeaveStaging`). `moveCard` (zones.ts), the optional engagement of the Harad family and `optionalEnemies` (quest/quest.ts, which leaves such an enemy out of the optional engagement offer) read it.
import { flagged, type ScenarioState } from "./state.ts";

export function cannotLeaveStaging(state: ScenarioState, id: string): boolean {
  return flagged(state, id, "cannotLeaveStaging") && !flagged(state, id, "losesCannotLeaveStaging");
}

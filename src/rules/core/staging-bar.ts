// A card that "cannot leave the staging area" and has not lost that bar (a stage or an effect that removes it sets `losesCannotLeaveStaging`). `moveCard` and the optional engagement of the Harad family read it.
import { flagged, type ScenarioState } from "./state.ts";

export function cannotLeaveStaging(state: ScenarioState, id: string): boolean {
  return flagged(state, id, "cannotLeaveStaging") && !flagged(state, id, "losesCannotLeaveStaging");
}

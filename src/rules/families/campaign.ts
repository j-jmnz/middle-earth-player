// Rules: rr.campaign-cards, rr.campaign-setup-checklist, ltp.campaign-setup-checklist (data/rules/entries.json).
import type { Instruction } from "../../catalog/boundary.ts";

import type { ScenarioState } from "../state.ts";
import { spawn } from "../zones.ts";
import type { Focus } from "./index.ts";

// The verbs src/catalog/families/campaign.ts adds. Only PutObjectiveAllyIntoPlay runs in the engine: it is a Setup instruction the
// campaign checklist hands the start. The others are dealt before the game starts (AttachChosen, AddToHandAfterMulligan,
// AddToPool: campaign/checklist.ts) or run by the Resolution (CarryOver: rules/resolution.ts), so they change nothing here.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus): ScenarioState | null {
  switch (instruction.verb) {
    case "PutObjectiveAllyIntoPlay":
      // Under the first player, ready (no Hide test, no reveal).
      return spawn(state, instruction.code, { zone: "play", seat: focus.seat }).state;
    case "AttachChosen":
    case "AddToHandAfterMulligan":
    case "AddToPool":
    case "CarryOver":
      return state;
    default:
      return null;
  }
}

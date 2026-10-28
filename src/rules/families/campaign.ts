// Rules: rr.campaign-cards, rr.campaign-setup-checklist, ltp.campaign-setup-checklist (data/rules/entries.json). RemoveFromGame is the
// 01135:A:4 line ("remove him from the game").
import type { Instruction } from "../../catalog/boundary.ts";

import type { ScenarioState } from "../state.ts";
import { frameScope, refCard } from "../amounts.ts";
import { moveCard, spawn } from "../zones.ts";
import type { Focus } from "./index.ts";

// The verbs src/catalog/families/campaign.ts adds. Only PutObjectiveAllyIntoPlay runs in the engine: it is a Setup instruction the
// campaign checklist hands the start. The others are dealt before the game starts (AttachChosen, AddToHandAfterMulligan,
// AddToPool: campaign/checklist.ts) or run by the Resolution (CarryOver: rules/resolution.ts), so they change nothing here.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus): ScenarioState | null {
  switch (instruction.verb) {
    case "PutObjectiveAllyIntoPlay":
      // Under the first player, ready (no Hide test, no reveal).
      return spawn(state, instruction.code, { zone: "play", seat: focus.seat }).state;
    case "RemoveFromGame": {
      const id = refCard(state, instruction.card ?? "self", frameScope(state, focus.seat, focus.sourceId));
      return id && state.cards[id] ? moveCard(state, id, { zone: "removed" }) : state;
    }
    case "AttachChosen":
    case "AddToHandAfterMulligan":
    case "AddToPool":
    case "CarryOver":
      return state;
    default:
      return null;
  }
}

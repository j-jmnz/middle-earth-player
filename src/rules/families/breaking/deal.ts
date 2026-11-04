// Rules: mec109.multiple-staging-areas (data/rules/entries.json); 142062:B:1.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { QueueItem, ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { sharedStaging } from "./areas.ts";

const PICK_SHARED: Instruction = { verb: "Pick", pick: { type: "card", control: "any", stagingOnly: true, stagingArea: "shared" } };
const MOVE_OWN: Instruction = { verb: "MovePickedToOwnStaging" };

// DealOutStaging (142062:B:1): "In player order, each player moves 1 encounter card from this staging area to theirs. When there are no encounter cards
// left at this stage, discard it." The running effect's queue gets one pick and one move for each seat in each round, as many rounds as the shared area
// has cards: a pick that finds the area empty records nothing and its move does nothing. A seat that has several cards to choose from chooses; the
// last card is taken without asking (rules/interpret/effect-frames.ts pick).
export function dealOut(state: ScenarioState, item: QueueItem): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect" || !state.separate) return state;
  const seats = livingSeats(state);
  const rounds = seats.length === 0 ? 0 : Math.ceil(sharedStaging(state).length / seats.length);
  const cause = item.cause ? { cause: item.cause } : {};
  const expanded = Array.from({ length: rounds }, () =>
    seats.flatMap((seat): QueueItem[] => [
      { instruction: PICK_SHARED, seat, chosen: null, ...cause },
      { instruction: MOVE_OWN, seat, chosen: null, ...cause },
    ]),
  ).flat();
  return patchTop(state, { data: { ...data, queue: [...expanded, ...data.queue] } });
}

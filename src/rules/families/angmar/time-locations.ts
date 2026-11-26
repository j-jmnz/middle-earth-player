// Rules: mec108.time-x, rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 08147:B:2, 08151:A:2, 08153:A:1, 08154:A:1, 08154:A:2, 08159:A:1, 08160:A:3. Time counters on the locations in play (The Antlered Crown): taken off each, off the active
// location, or divided among them one at a time; put on the ones with none; and the Time X value of the active location as an amount. The keyword, its counters and the one-counter removal are time.ts.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { isLocationId } from "../../core/printed.ts";
import { type ScenarioState, updateCard } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";
import { textBlank } from "../attachments/hold.ts";
import { activeLocations } from "../south/locations.ts";
import { distributeOneAtATime } from "./distribute.ts";
import { holdsTimeCounter, removeTimeCounterFrom, timeLimit, timeOf } from "./time.ts";

type Remove = Extract<Instruction, { verb: "RemoveTimeCounters" }>;

/** The locations in play: the staging area's, then the active ones. */
export function locationsInPlay(state: ScenarioState, ctx: ReduceContext): string[] {
  return [...state.staging, ...activeLocations(state)].filter((id) => isLocationId(state, id, ctx.cards));
}

/**
 * RemoveTimeCounters on locations: `locations` takes up to `amount` counters, one at a time, off each location in play that holds some; `active` off the active location, if it holds any. A location whose last counter goes is announced (`lastTimeCounterRemoved`) and its Forced effect
 * resolves after the effect that removed it. With `distribute` the total is divided among the locations that hold counters, one counter at a time, by the actor or the first player (rr.first-player): a single location is taken without asking.
 */
export function removeTimeCountersFromLocations(state: ScenarioState, instruction: Remove, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const amount = instruction.amount == null ? 1 : resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  if (instruction.distribute != null) return distribute(state, instruction, amount, focus, ctx, steps);
  const targets = (instruction.target === "active" ? activeLocations(state) : locationsInPlay(state, ctx)).filter((id) => holdsTimeCounter(state, id, ctx));
  let next = state;
  for (const id of targets) for (let removed = 0; removed < amount; removed += 1) next = removeTimeCounterFrom(next, id, ctx);
  return next;
}

// One counter at a time: the chooser picks the location, and the rest of the total waits in a queued copy of the instruction (`left`).
function distribute(state: ScenarioState, instruction: Remove, total: number, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = instruction.distribute === "firstPlayer" ? state.firstPlayer : focus.seat;
  const options = locationsInPlay(state, ctx).filter((id) => holdsTimeCounter(state, id, ctx));
  return distributeOneAtATime(state, { instruction, left: instruction.left ?? total, seat, options, focus, steps, takeOne: (from, id) => removeTimeCounterFrom(from, id, ctx) });
}

/** PlaceTimeCounters on `locationsWithNone`: each location in play with the Time X keyword, its text not blank, and no time counter gets its printed X, as one revealed does (mec108.time-x). */
export function placeTimeCounters(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const id of locationsInPlay(state, ctx)) {
    const card = next.cards[id];
    const amount = card == null ? null : timeLimit(next, ctx, card.code);
    if (card == null || amount == null || card.resources > 0 || textBlank(next, id, ctx.cards)) continue;
    next = updateCard(next, id, { resources: amount });
  }
  return next;
}

/** The amount `timeOfActive`: the printed Time X of the active location, 0 with none or without the keyword. Null for any other amount. */
export function timeOfActiveAmount(state: ScenarioState, found: { timeOfActive?: true | undefined }, ctx: ReduceContext): number | null {
  if (found.timeOfActive !== true) return null;
  const active = state.activeLocation ? state.cards[state.activeLocation] : undefined;
  return (active == null ? null : timeOf(ctx, active.code)) ?? 0;
}

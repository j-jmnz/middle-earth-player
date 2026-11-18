// Rules: rr.forced, rr.active-location, rr.explored (data/rules/entries.json); ledger line 04092:A:1. The placement a Forced effect on `progressWouldBePlaced` lets through (hold.ts holds it).
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { placeProgress } from "../../interpret/effect-verbs.ts";
import type { ScenarioState } from "../../core/state.ts";
import { effectData } from "../encounter/moves.ts";
import { progressToQuest } from "../quest/doors.ts";
import { progressRoom } from "../south/locations.ts";
import type { Focus } from "../index.ts";

/** PlaceHeldProgress: the amount the answered event held (the effect's X) goes on the source location, past the hold. What the quest phase's total left over once the location is full goes to the current quest, as the overflow of an explored active location does (rr.active-location). */
export function placeHeldProgress(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const amount = effectData(state)?.x ?? 0;
  const id = focus.sourceId;
  if (!id || !state.cards[id] || amount <= 0) return state;
  const room = progressRoom(state, id, ctx.cards);
  const placed = placeProgress(state, id, Math.min(amount, room), ctx, steps, undefined, true);
  return state.phase === "Quest" && amount > room && room > 0 ? progressToQuest(placed, amount - room, ctx, steps) : placed;
}

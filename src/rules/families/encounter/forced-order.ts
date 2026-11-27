// Rules: rr.forced (data/rules/entries.json). OrderForced (engine use, windows/triggers.ts): the Forced effects of one event that differ are initiated in the order the first player chooses. The first player picks
// the card whose effects initiate next; they resolve completely before the rest are offered again, so a choice is asked once for each card but the last. What the cards print holds some back (`early`, `afterForcedOn`: orderOptions).
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { nextInOrder } from "../../windows/in-order.ts";
import { foundOf, orderOptions, pushCounted } from "../../windows/triggers.ts";
import type { Focus } from "../index.ts";
import { effectData } from "./moves.ts";

type OrderForced = Extract<Instruction, { verb: "OrderForced" }>;

export function orderForced(state: ScenarioState, instruction: OrderForced, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const event = effectData(state)?.orderEvent;
  if (!event) throw new Error("OrderForced lost its event");
  const found = foundOf(state, ctx, instruction.entries);
  // Every card or effect is gone: nothing is left to order.
  if (found.length === 0) return state;
  const next = nextInOrder(state, {
    options: orderOptions(found),
    picked: focus.chosen,
    ask: { instruction, seat: state.firstPlayer, chosen: null },
    // The rest wait in this frame's queue and are offered again once the chosen card's effects have resolved.
    rest: (chosen) => {
      const rest = instruction.entries.filter((entry) => entry.sourceId !== chosen);
      return rest.length > 0 ? { instruction: { verb: "OrderForced", entries: rest }, seat: state.firstPlayer, chosen: null } : null;
    },
  });
  return next.chosen == null ? next.state : pushCounted(next.state, found.filter((one) => one.instance.id === next.chosen), event, ctx, steps);
}

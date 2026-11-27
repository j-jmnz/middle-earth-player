// Rules: rr.forced (data/rules/entries.json). OrderForced (engine use, windows/triggers.ts): the Forced effects of one event that differ are initiated in the order the first player chooses. The first player picks
// the card whose effects initiate next; they resolve completely before the rest are offered again, so a choice is asked once for each card but the last.
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { forcedOrderDiffers, foundOf, pushFound } from "../../windows/triggers.ts";
import type { Focus } from "../index.ts";
import { queueFront } from "../play/refs.ts";
import { effectData } from "./moves.ts";

type OrderForced = Extract<Instruction, { verb: "OrderForced" }>;

export function orderForced(state: ScenarioState, instruction: OrderForced, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const event = effectData(state)?.orderEvent;
  if (!event) return state;
  const found = foundOf(state, ctx, instruction.entries);
  // Nothing differs any more: the default order stands.
  if (!forcedOrderDiffers(found)) return pushFound(state, found, event, ctx, steps, true);
  if (focus.chosen == null) {
    // The cards to choose from: one of each set of effects (two copies of a card bear the same effects).
    const seen = new Set<string>();
    const options: string[] = [];
    for (const one of found) {
      const signature = found.filter((other) => other.instance.id === one.instance.id).map((other) => other.effect.id).join(",");
      if (options.includes(one.instance.id) || seen.has(signature)) continue;
      seen.add(signature);
      options.push(one.instance.id);
    }
    if (options.length < 2) return pushFound(state, found, event, ctx, steps, true);
    return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null }, options);
  }
  const chosen = found.filter((one) => one.instance.id === focus.chosen);
  const rest = instruction.entries.filter((entry) => entry.sourceId !== focus.chosen);
  // The rest wait in this frame's queue and are offered again once the chosen card's effects have resolved.
  const waiting = rest.length > 0 ? queueFront(state, [{ instruction: { verb: "OrderForced", entries: rest }, seat: state.firstPlayer, chosen: null }]) : state;
  return pushFound(waiting, chosen, event, ctx, steps, true);
}

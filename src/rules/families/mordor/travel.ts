// Rules: rr.travel, rr.cost, rr.blank (data/rules/entries.json); ledger lines 21051:A:1, 21051:A:2.
// ResolveActiveTravel: the Travel effect of the active location resolves as an effect of its card, its cost unpaid and the location not moved.
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { textBlank } from "../attachments/hold.ts";
import { recordsOfFace } from "../dreamchaser/faces.ts";
import type { Focus } from "../index.ts";

/** The records of the active location with the timing travel run in a frame of their own, for the acting seat. With no active location, a blank text box or no Travel line nothing happens. */
export function resolveActiveTravel(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.activeLocation;
  const location = id ? state.cards[id] : undefined;
  if (!id || !location || textBlank(state, id, ctx.cards)) return state;
  const effects = recordsOfFace(location, ctx.effects.filter((effect) => effect.cardCode === location.code)).filter((effect) => effect.timing === "travel");
  return pushCardEffects(state, "ResolveEffect", id, focus.seat, false, effects, ctx, steps);
}

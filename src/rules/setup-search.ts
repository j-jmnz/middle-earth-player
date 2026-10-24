import type { Effect } from "../catalog/boundary.ts";

import type { EngineStep } from "./intents.ts";
import { runEffect, type ReduceContext } from "./interpret.ts";
import type { ScenarioState } from "./state.ts";
import { withFrame } from "./windows.ts";
import { moveCard } from "./zones.ts";

export function searchSetup(
  state: ScenarioState,
  kind: "player" | "encounter",
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const effects = ctx.effects.filter((effect) => effect.timing === "setup");
  if (effects.length === 0) return state;
  let next = state;
  for (const effect of effects) {
    const found = setupIds(next, effect.cardCode, kind);
    for (const foundId of found) {
      const seat = next.cards[foundId]?.controller ?? next.firstPlayer;
      next = moveCard(next, foundId, { zone: "setAside" });
      next = runEffectBody(next, effect, foundId, seat, ctx, steps);
      if (next.failure || next.lost) return next;
    }
  }
  return next;
}

function runEffectBody(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  return withFrame(state, "setup", sourceId, false, (framed) => {
    return runEffect(framed, effect, sourceId, seat, ctx, steps);
  }, steps);
}

function setupIds(state: ScenarioState, code: string, kind: "player" | "encounter"): string[] {
  if (kind === "encounter") {
    return state.encounterDeck.filter((id) => state.cards[id]?.code === code);
  }
  const ids: string[] = [];
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    for (const id of state.seats[seat]?.deck ?? []) {
      if (state.cards[id]?.code === code) ids.push(id);
    }
  }
  return ids;
}

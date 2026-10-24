import type { Instruction } from "../catalog/boundary.ts";

import { hasTrait } from "./conditions.ts";
import { runQuestResolution } from "./explore.ts";
import type { EngineStep } from "./intents.ts";
import { drawOne, type ReduceContext } from "./interpret.ts";
import { destroyCard } from "./keywords.ts";
import { printedOf } from "./printed.ts";
import { questPointsOf } from "./quest.ts";
import { offerResponses } from "./responses.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats, updateCard } from "./state.ts";
import { currentCause, UNATTRIBUTED } from "./cause.ts";

export type TargetVerb = Extract<Instruction, { verb: "ReadyHero" | "BarAttack" | "PlaceProgressOnLocation" }>;

export function isTargetVerb(instruction: Instruction): instruction is TargetVerb {
  return instruction.verb === "ReadyHero" || instruction.verb === "BarAttack" || instruction.verb === "PlaceProgressOnLocation";
}

// One card per Hobbit hero (or whatever trait is named) the seat controls, or one card with no trait.
export function drawVerb(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "Draw" }>,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const trait = instruction.perHero;
  const count = trait == null ? 1 : (state.seats[seat]?.heroes ?? []).filter((id) => hasTrait(state, id, trait, ctx)).length;
  let next = state;
  for (let draw = 0; draw < count; draw += 1) next = drawOne(next, seat, steps, UNATTRIBUTED);
  return next;
}

// The cards a player may pick for the verb.
export function targetCandidates(state: ScenarioState, instruction: TargetVerb, seat: number, ctx: ReduceContext): string[] {
  switch (instruction.verb) {
    case "ReadyHero":
      return (state.seats[seat]?.heroes ?? []).filter((id) => state.cards[id]?.exhausted === true);
    case "BarAttack":
      return (state.seats[seat]?.engaged ?? []).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy");
    case "PlaceProgressOnLocation": {
      const open = [...(state.activeLocation ? [state.activeLocation] : []), ...state.staging];
      return open.filter((id) => {
        const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
        return printed.type === "location" && !printed.isUnique;
      });
    }
  }
}

export function applyTargetVerb(
  state: ScenarioState,
  instruction: TargetVerb,
  id: string | undefined,
  sourceId: string | null,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  if (!id || !state.cards[id]) return state;
  switch (instruction.verb) {
    case "ReadyHero":
      return updateCard(state, id, { exhausted: false });
    case "BarAttack":
      return sourceId
        ? { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId, stat: "cannotAttack", amount: 1, until: "endOfRound", seat }] }
        : state;
    case "PlaceProgressOnLocation":
      return placeProgress(state, id, instruction.perPlayer * livingSeats(state).length, ctx, steps);
  }
}

// Progress on a location in play. A location that is full is explored and leaves play.
function placeProgress(state: ScenarioState, id: string, amount: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const location = state.cards[id];
  if (!location) return state;
  const points = questPointsOf(state, location, ctx.cards);
  const placed = points == null ? amount : Math.min(amount, Math.max(0, points - location.progress));
  if (placed <= 0) return state;
  steps.push({ kind: "progress", targetId: id, amount: placed, cause: currentCause(steps, UNATTRIBUTED) });
  const next = updateCard(state, id, { progress: location.progress + placed });
  if (points == null || location.progress + placed < points) return next;
  const explored = destroyCard(next, id, ctx.cards, steps);
  return offerResponses(runQuestResolution(explored, id, ctx, steps), { trigger: "leftPlay", seat: null, cardId: id }, ctx, steps);
}

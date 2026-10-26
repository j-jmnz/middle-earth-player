import type { Instruction } from "../catalog/boundary.ts";

import { frameScope, resolveAmount } from "./amounts.ts";
import { hasTrait } from "./conditions.ts";
import { runQuestResolution } from "./explore.ts";
import type { EngineStep } from "./intents.ts";
import { drawOne, type ReduceContext } from "./interpret.ts";
import { destroyCard, playerCardEffectCanChoose } from "./keywords.ts";
import { printedOf } from "./printed.ts";
import { questPointsOf } from "./quest.ts";
import { notePlaced, progressRoom } from "./families/south-locations.ts";
import { announceLeftPlay } from "./stage-reveal.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats, updateCard } from "./state.ts";
import { currentCause, UNATTRIBUTED } from "./cause.ts";
import { lastPicked, seatOf } from "./player-verbs.ts";
import { topFrame } from "./windows.ts";

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
  const data = topFrame(state)?.data;
  const target =
    instruction.who === "picked"
      ? seatOf(lastPicked(state))
      : instruction.who === "eventSeat"
        ? data?.kind === "effect"
          ? (data.eventSeat ?? null)
          : null
        : instruction.who === "firstPlayer"
          ? state.firstPlayer
          : seat;
  if (target == null) return state;
  const trait = instruction.perHero;
  const amount = instruction.amount == null ? 1 : resolveAmount(state, instruction.amount, frameScope(state, seat, topFrame(state)?.cardId ?? null), ctx);
  const count = (trait == null ? 1 : (state.seats[target]?.heroes ?? []).filter((id) => hasTrait(state, id, trait, ctx)).length) * amount;
  let next = state;
  for (let draw = 0; draw < count; draw += 1) next = drawOne(next, target, steps, UNATTRIBUTED);
  return next;
}

// The cards a player may pick for the verb.
export function targetCandidates(state: ScenarioState, instruction: TargetVerb, seat: number, ctx: ReduceContext): string[] {
  switch (instruction.verb) {
    case "ReadyHero":
      return (state.seats[seat]?.heroes ?? []).filter((id) => state.cards[id]?.exhausted === true);
    case "BarAttack": {
      const seats = instruction.scope === "any" ? livingSeats(state) : [seat];
      return seats
        .flatMap((index) => state.seats[index]?.engaged ?? [])
        .filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy")
        .filter((id) => instruction.scope !== "any" || playerCardEffectCanChoose(printedOf(ctx.cards, state.cards[id]?.code ?? "")));
    }
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
    case "BarAttack": {
      const barred = instruction.scope === "any" ? (state.cards[id]?.controller ?? seat) : seat;
      return sourceId
        ? { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId, stat: "cannotAttack", amount: 1, until: instruction.until ?? "endOfRound", seat: barred }] }
        : state;
    }
    case "PlaceProgressOnLocation":
      return placeProgress(state, id, instruction.perPlayer * livingSeats(state).length, ctx, steps);
  }
}

// Progress on a location in play. A location that is full is explored and leaves play.
export function placeProgress(state: ScenarioState, id: string, amount: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const location = state.cards[id];
  if (!location) return state;
  const points = questPointsOf(state, location, ctx.cards);
  // What a gate or a cap leaves out (Doors of Durin, Snowdrifts; families/south-locations.ts).
  const placed = Math.min(amount, progressRoom(state, id, ctx.cards));
  if (placed <= 0) return state;
  steps.push({ kind: "progress", targetId: id, amount: placed, cause: currentCause(steps, UNATTRIBUTED) });
  const next = notePlaced(updateCard(state, id, { progress: location.progress + placed }), id, placed);
  if (points == null || location.progress + placed < points) return next;
  const explored = destroyCard(next, id, ctx.cards, steps, true);
  return announceLeftPlay(runQuestResolution(explored, id, ctx, steps), id, ctx, steps, true);
}

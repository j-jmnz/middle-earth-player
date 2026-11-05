import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "./amounts.ts";
import { hasTrait } from "./conditions.ts";
import { runQuestResolution } from "../quest/explore.ts";
import type { EngineStep } from "../core/intents.ts";
import { drawMany, type ReduceContext } from "./interpret.ts";
import { destroyCard, playerCardEffectCanChoose } from "../core/keywords.ts";
import { activeOf, stagingOf } from "../families/breaking/areas.ts";
import { cancelAttack } from "../families/defense/defenders.ts";
import { printedOf } from "../core/printed.ts";
import { questPointsOf } from "../quest/quest.ts";
import { notePlaced, progressRoom } from "../families/south/locations.ts";
import { announceLeftPlay } from "../quest/stage-reveal.ts";
import type { ScenarioState } from "../core/state.ts";
import { livingSeats, updateCard } from "../core/state.ts";
import { readyBarred } from "../core/holder-classes.ts";
import { currentCause, UNATTRIBUTED } from "../core/cause.ts";
import { byPlayerCards, lastPicked, seatOf } from "./player-verbs.ts";
import { topFrame } from "../windows/windows.ts";
import { exploring } from "../families/island/map.ts";

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
  return drawMany(state, target, count, steps, UNATTRIBUTED, ctx, instruction.from === "bottom");
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
        .filter((id) => instruction.scope !== "any" || playerCardEffectCanChoose(printedOf(ctx.cards, state.cards[id]?.code ?? ""), state, id));
    }
    case "PlaceProgressOnLocation": {
      // The seat's own active location and staging area once stages are separate.
      const active = activeOf(state, seat);
      const open = [...(active ? [active] : []), ...stagingOf(state, seat)];
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
      return readyBarred(state, id, byPlayerCards(state, sourceId, ctx)) ? state : updateCard(state, id, { exhausted: false });
    case "BarAttack": {
      const barred = instruction.scope === "any" ? (state.cards[id]?.controller ?? seat) : seat;
      if (!sourceId) return state;
      const next: ScenarioState = { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId, stat: "cannotAttack", amount: 1, until: instruction.until ?? "endOfRound", seat: barred }] };
      // Every "cannot attack" bar (Mr. Underhill after a failed Hide test, 141017:A:3; Feint): used once the enemy is declared as an attacker
      // against that player and before its damage is dealt, the attack ends there, as a canceled one does (user decision, 2026-10-31; brief,
      // Keywords implemented once). After the damage the attack has happened, and its end (readies, "after ~ defends") goes on.
      const attack = state.pendingAttack;
      return attack?.enemyId === id && attack.seat === barred && !attack.damaged ? cancelAttack(next) : next;
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
  // What a gate or a cap leaves out (Doors of Durin, Snowdrifts; families/south/locations.ts).
  const placed = Math.min(amount, progressRoom(state, id, ctx.cards));
  if (placed <= 0) return state;
  steps.push({ kind: "progress", targetId: id, amount: placed, cause: currentCause(steps, UNATTRIBUTED) });
  const next = notePlaced(updateCard(state, id, { progress: location.progress + placed }), id, placed);
  // Under Exploration a location with progress equal to its quest points is not explored; it remains in play (dcce.exploration).
  if (points == null || location.progress + placed < points || exploring(next)) return next;
  const explored = destroyCard(next, id, ctx.cards, steps, true);
  return announceLeftPlay(runQuestResolution(explored, id, ctx, steps), id, ctx, steps, true);
}

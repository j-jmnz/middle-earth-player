import type { Instruction } from "../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "./cause.ts";
import { characters, strikeEnemy } from "./combat.ts";
import { placeProgress } from "./effect-verbs.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { lowerThreat, placeDamage } from "./keywords.ts";
import { stagingLocations } from "./quest.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats, updateCard } from "./state.ts";
import { topFrame } from "./windows.ts";
import { moveCard } from "./zones.ts";

// Verbs of the player cards. A Pick (effect-frames.ts) chooses a card or a player and the verbs after it act on the choice.
export type PlayerFocus = { seat: number; sourceId: string | null };

export function pickedList(state: ScenarioState): readonly string[] {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? (data.picked ?? []) : [];
}

// The last thing a Pick chose: a card id, "seat:N" for a player, or "" when there was nothing to choose.
export function lastPicked(state: ScenarioState): string {
  return pickedList(state).at(-1) ?? "";
}

// "seat:1" -> 1.
export function seatOf(picked: string): number | null {
  const match = /^seat:(\d+)$/.exec(picked);
  return match ? Number(match[1]) : null;
}

// The seat after `seat` that is still in the game, or null when the player is alone.
export function otherSeat(state: ScenarioState, seat: number): number | null {
  const living = livingSeats(state);
  const at = living.indexOf(seat);
  const next = living[(at + 1) % living.length];
  return next == null || next === seat ? null : next;
}

function seatsFor(state: ScenarioState, who: "actor" | "picked" | "eachSeat", actor: number): number[] {
  if (who === "eachSeat") return livingSeats(state);
  if (who === "picked") {
    const seat = seatOf(lastPicked(state));
    return seat == null ? [] : [seat];
  }
  return [actor];
}

// Returns the new state when the instruction is one of these verbs, otherwise null.
export function runPlayerVerb(
  state: ScenarioState,
  instruction: Instruction,
  focus: PlayerFocus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState | null {
  switch (instruction.verb) {
    case "Ready": {
      if (instruction.target === "picked") {
        const id = lastPicked(state);
        return state.cards[id] ? updateCard(state, id, { exhausted: false }) : state;
      }
      if (instruction.target === "host") {
        const hostId = focus.sourceId ? state.cards[focus.sourceId]?.host : null;
        return hostId && state.cards[hostId] ? updateCard(state, hostId, { exhausted: false }) : state;
      }
      if (instruction.target !== "allCharacters") return null;
      let next = state;
      for (const seat of livingSeats(state)) for (const id of characters(state, seat, ctx.cards)) next = updateCard(next, id, { exhausted: false });
      return next;
    }
    case "Exhaust": {
      if (instruction.target?.kind !== "picked") return null;
      const id = lastPicked(state);
      return state.cards[id] ? updateCard(state, id, { exhausted: true }) : state;
    }
    case "LowerThreat": {
      let next = state;
      for (const seat of seatsFor(state, instruction.who, focus.seat)) next = lowerThreat(next, seat, instruction.amount, steps, currentCause(steps, UNATTRIBUTED));
      return next;
    }
    case "DamageCard": {
      const id = lastPicked(state);
      return state.cards[id] ? placeDamage(state, id, instruction.amount, ctx.cards, steps, "player", currentCause(steps, UNATTRIBUTED)) : state;
    }
    case "PlaceProgressOn": {
      const targets = instruction.target === "picked" ? [lastPicked(state)] : stagingLocations(state, ctx.cards);
      let next = state;
      for (const id of targets) if (next.cards[id]) next = placeProgress(next, id, instruction.amount, ctx, steps);
      return next;
    }
    case "GiveControl": {
      const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      const seat = otherSeat(state, focus.seat);
      if (!source || seat == null) return state;
      return moveCard(state, source.id, { zone: "play", seat });
    }
    case "AttackEnemy": {
      const list = pickedList(state);
      const attackerId = list.at(-2) ?? "";
      const enemyId = list.at(-1) ?? "";
      const attacker = state.cards[attackerId];
      if (!attacker || !state.cards[enemyId] || attacker.controller == null) return state;
      return strikeEnemy(state, attacker.controller, enemyId, [attackerId], ctx, steps);
    }
    default:
      return null;
  }
}

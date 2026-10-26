// Rules: rr.damage, rr.response, rr.reveal, rr.lasting-effects, mec109.immune-to-player-card-effects (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { placeDamage } from "./keywords.ts";
import { lastPicked, seatOf } from "./player-verbs.ts";
import { printedOf } from "./printed.ts";
import type { GameEvent, ScenarioState } from "./state.ts";
import { inPlay, updateCard } from "./state.ts";

// Damage and healing of the core-set player cards (user request, 2026-10-26). A player card's damage is a player card effect:
// a card immune to them takes none (placeDamage).
export type DamageFocus = { seat: number; sourceId: string | null };

// The event the running Response answers: the response frame under it holds it (responses.ts). Null outside a Response.
export function answeredEvent(state: ScenarioState): GameEvent | null {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const data = state.stack[index]?.data;
    if (data?.kind === "responses") return data.answering ?? data.event;
  }
  return null;
}

// The card being revealed: the card of the nearest reveal frame under the running effect (frames.ts).
function revealedCard(state: ScenarioState): string | null {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame?.frame === "reveal") return frame.cardId;
  }
  return null;
}

// Heals `amount` damage at most, or all of it (rr.damage: damage tokens come off the card). The step records the damage
// removed as a negative amount, the way a progress removal is recorded.
export function heal(state: ScenarioState, id: string, amount: number | undefined, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone) || card.damage <= 0) return state;
  const healed = Math.min(card.damage, amount ?? card.damage);
  steps.push({ kind: "damage", targetId: id, amount: -healed, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, id, { damage: card.damage - healed });
}

function healTargets(state: ScenarioState, instruction: Extract<Instruction, { verb: "Heal" }>, focus: DamageFocus): string[] {
  switch (instruction.target) {
    case "picked":
      return [lastPicked(state)];
    case "host": {
      const host = focus.sourceId ? state.cards[focus.sourceId]?.host : null;
      return host ? [host] : [];
    }
    case "pickedPlayerHeroes": {
      const seat = seatOf(lastPicked(state));
      return seat == null ? [] : [...(state.seats[seat]?.heroes ?? [])];
    }
  }
}

// Returns the new state when the instruction is one of these verbs, otherwise null.
export function runDamageVerb(state: ScenarioState, instruction: Instruction, focus: DamageFocus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "Heal": {
      let next = state;
      for (const id of healTargets(state, instruction, focus)) next = heal(next, id, instruction.amount, steps);
      return next;
    }
    case "DamageAttacker": {
      const enemyId = state.pendingAttack?.enemyId;
      return enemyId && state.cards[enemyId] ? placeDamage(state, enemyId, instruction.amount, ctx.cards, steps, "player", currentCause(steps, UNATTRIBUTED)) : state;
    }
    case "DamageRevealed": {
      const id = revealedCard(state);
      const card = id ? state.cards[id] : undefined;
      if (!id || !card || printedOf(ctx.cards, card.code).type !== "enemy") return state;
      return placeDamage(state, id, instruction.amount, ctx.cards, steps, "player", currentCause(steps, UNATTRIBUTED));
    }
    default:
      return null;
  }
}

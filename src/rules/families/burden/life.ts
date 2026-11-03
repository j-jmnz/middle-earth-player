// Rules: mec109.ringbearers-life (data/rules/entries.json).
//
// The Ring-bearer's life (Flight to the Ford): a number of its own, set by the quest card's Setup. Only a card effect lowers it,
// by `ReduceLife`, and each reduction is a step with its cause. Healing a character never raises it, and a hero that An Evil
// Wound is attached to takes the damage it would be dealt as a reduction of the life instead (the `damageToLife` flag). At 0 the
// players lose the game. Kept free of engine imports beyond the state, so keywords.ts and player-verbs.ts can call it.
import type { Cause } from "../../cause.ts";
import type { EngineStep } from "../../intents.ts";
import type { ScenarioState } from "../../state.ts";
import { flagged } from "../../state.ts";

// The life of the Ring-bearer goes down by `amount`, to a minimum of 0. The step records what it actually dropped. A game with no
// life number is not changed.
export function reduceLife(state: ScenarioState, amount: number, steps: EngineStep[], cause: Cause): ScenarioState {
  if (state.life == null || amount <= 0) return state;
  const dropped = Math.min(amount, state.life);
  if (dropped <= 0) return state;
  steps.push({ kind: "life", amount: -dropped, cause });
  const life = state.life - dropped;
  const next: ScenarioState = { ...state, life };
  // "If the Ring-bearer's life reaches 0, the players lose the game" (mec109.ringbearers-life, 141057:A:3).
  return life <= 0 && !next.lost ? { ...next, lost: true, lossReason: "The Ring-bearer's life reached 0" } : next;
}

// The damage a hero would take reduces the life instead (141057:A:2): the hero is not damaged.
export function takesLifeInstead(state: ScenarioState, id: string): boolean {
  return state.life != null && flagged(state, id, "damageToLife");
}

// Damage cannot be healed from the card (141057:A:1: "Attached hero cannot be healed").
export function healBlocked(state: ScenarioState, id: string): boolean {
  return flagged(state, id, "cannotBeHealed");
}

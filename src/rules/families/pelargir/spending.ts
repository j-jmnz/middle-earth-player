// Rules: rr.cannot, rr.resources (data/rules/entries.json); ledger line 05058:A:1.
// Orc Vanguard in the staging area: no resource can be spent from the pool of a hero with a Leadership, Spirit or Lore icon. Resources can still be gained and moved, and discarded (a discard is not spending). A constant on the hero sets `cannotSpendResources`; every spender reads it:
// costs/pay.ts payerOk, costs/verbs.ts spendablePools and SpendResources from one pool, encounter/items.ts PayResources, play/leave.ts SpendFrom, defense/index.ts SpendFromPool. What is offered before a spend reads it too, so a locked pool is not
// offered for a payment it cannot make (interpret/pick.ts `spends`, windows/choices.ts, player/potential.ts, defense/conditions.ts groupResources).
import type { Instruction } from "../../../catalog/boundary.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

/** Whether resources cannot be spent from this card's pool. */
export function resourcesLocked(state: ScenarioState, id: string): boolean {
  return state.modifiers.length > 0 && flagged(state, id, "cannotSpendResources");
}

/** A spend a lock stops: nothing is paid, and what the payment was for does not resolve, so the rest of the effect's steps are dropped (Elfhelm's play, Livery of the Tower's cancel). */
export function stopLockedSpend(state: ScenarioState): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? patchTop(state, { data: { ...data, queue: [] } }) : state;
}

/** Whether a hero holds the lock: the one guard every read before a spend starts with, so a game without the flag reads nothing. */
export function anyLocked(state: ScenarioState): boolean {
  return state.modifiers.length > 0 && Object.values(state.cards).some((card) => card.zone === "heroes" && flagged(state, card.id, "cannotSpendResources"));
}

/** Whether the instruction spends from the card the Pick before it chose (SpendFrom, SpendFromPool): the pick leaves out a locked pool, which cannot pay. */
export function spendsPicked(instruction: Instruction | undefined): boolean {
  if (instruction?.verb === "SpendFrom") return (instruction.card ?? "picked") === "picked";
  return instruction?.verb === "SpendFromPool" && (instruction.from ?? "picked") === "picked";
}

/** A spend with a pool the effect names (Livery of the Tower's host) that is locked: the effect cannot pay, so it is not offered. */
export function spendsLockedHost(state: ScenarioState, steps: readonly Instruction[], hostId: string | null): boolean {
  return hostId != null && steps.some((step) => step.verb === "SpendFromPool" && step.from === "host") && resourcesLocked(state, hostId);
}

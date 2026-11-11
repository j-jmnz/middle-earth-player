// Rules: dcce.aflame (data/rules/entries.json); ledger lines 11038:A:1, 11038:A:2, 11039:A:4. Aflame X: at the end of each round every Aflame location in the staging area takes 1 damage, and an Aflame
// location with damage equal to its Aflame value, wherever it is in play, is destroyed: it is placed facedown underneath The Havens Burn, out of play, and the cards that hear it are told.
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { EngineStep } from "../../core/intents.ts";
import { ruleCause } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { placeUnderHost } from "../encounter/moves.ts";
import { aflameOf, burnId } from "./values.ts";

/** "At the end of each round, the players must place 1 damage on each Aflame location in the staging area." */
export function burnAtRoundEnd(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of state.staging) if (aflameOf(state, id, ctx) != null) next = placeDamage(next, id, 1, ctx.cards, steps, "framework", ruleCause("dcce.aflame"));
  return next;
}

/** An Aflame location in play whose damage has reached its Aflame value goes facedown underneath The Havens Burn (a game without the objective leaves it where it is). */
export function aflameSweep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.lost || state.stageCleared) return state;
  const burn = burnId(state, ctx);
  if (!burn) return state;
  let next = state;
  for (const id of [...state.staging, state.activeLocation, state.secondActiveLocation]) {
    const value = id ? aflameOf(next, id, ctx) : null;
    const card = id ? next.cards[id] : undefined;
    if (!id || !card || value == null || card.damage < value) continue;
    next = placeUnderHost(next, id, burn, ctx, steps);
  }
  return next;
}

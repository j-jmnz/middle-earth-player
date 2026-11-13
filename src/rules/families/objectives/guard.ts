// Rules: rr.guarded (data/rules/entries.json); ledger lines 12121:A:1, 12126:A:3, 12127:A:3, 12133:A:1.
//
// "Attach X to that objective, guarding it": an enemy already in play becomes the guard of an objective in the staging area, as the card Guarded reveals does. An engaged enemy returns to the
// staging area first. The objective then has an encounter card attached: it is guarded until the guard leaves play.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

export function attachGuard(state: ScenarioState, instruction: Extract<Instruction, { verb: "AttachGuard" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const guardId = refCard(state, instruction.guard ?? "self", scope);
  const objectiveId = refCard(state, instruction.to ?? "picked", scope);
  const guard = guardId ? state.cards[guardId] : undefined;
  const objective = objectiveId ? state.cards[objectiveId] : undefined;
  if (!guardId || !objectiveId || !guard || !objective || guardId === objectiveId) return state;
  if (objective.zone !== "staging" || printedOf(ctx.cards, objective.code).type !== "objective") return state;
  if (guard.zone !== "staging" && guard.zone !== "engaged") return state;
  return guardWith(state, guardId, objectiveId);
}

/** The encounter card `guardId` (in the staging area, or engaged and returned to it) becomes the guard of `objectiveId`: attached to it, staying in the staging area. `stayEngaged`: an engaged guard keeps its engagement (nothing moves it, 12189:B:2). */
export function guardWith(state: ScenarioState, guardId: string, objectiveId: string, stayEngaged = false): ScenarioState {
  const guard = state.cards[guardId];
  if (!guard) return state;
  const returned = guard.zone === "engaged" && !stayEngaged ? updateCard(moveCard(state, guardId, { zone: "staging" }), guardId, { controller: null }) : state;
  return updateCard(attachTo(returned, guardId, objectiveId), guardId, { guard: true });
}

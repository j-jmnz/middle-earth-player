// Rules: rr.encounter-deck, rr.staging, rr.then (data/rules/entries.json); ledger line 900810:A:1. Enemies returned from the encounter discard pile to the staging area.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { moveEncounter, typeOf } from "./moves.ts";

/** ReturnFromDiscard: the topmost enemies with the Trait in the encounter discard pile (the last placed first), up to `count`, go to the staging area and are counted as returned. */
export function returnFromDiscard(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReturnFromDiscard" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const count = Math.max(0, resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx));
  const ids = [...state.encounterDiscard].reverse().filter((id) => typeOf(state, id, ctx) === "enemy" && hasTrait(state, id, instruction.trait, ctx)).slice(0, count);
  // Where they go: engaged with the first player (Blackroot Graves), or the staging area.
  const [zone, seat] = instruction.to === "engagedFirstPlayer" ? (["engaged", state.firstPlayer] as const) : (["staging", focus.seat] as const);
  let next = state;
  for (const id of ids) next = moveEncounter(next, id, zone, seat, ctx, steps);
  const data = topFrame(next)?.data;
  return data?.kind === "effect" ? patchTop(next, { data: { ...data, returned: data.returned + ids.length } }) : next;
}

// Rules: rr.the-word-choose (data/rules/entries.json).
//
// A Choose with `upTo` takes its options one at a time, each once, until the actor says "done" or the limit is reached ("choose up to X options, where X is its level", 11201:A:1); it keeps
// the options taken as `different` does.
//
// A Choose whose options may each be taken once in the effect ("Starting with the first player, each player chooses 1
// different option", The White Council 08010): the options taken are kept on the effect frame, and a later Choose of the
// same effect offers the others.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

type ChooseInstruction = Extract<Instruction, { verb: "Choose" }>;

function taken(state: ScenarioState): readonly string[] {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? (data.options ?? []) : [];
}

/** The option that stops a Choose with `upTo`. */
export const DONE = "done";

const keepsTaken = (instruction: ChooseInstruction): boolean => instruction.different === true || instruction.upTo != null;

/** The options a Choose may offer now: for a `different` Choose, those this effect has not taken yet. */
export function untakenOptions<Option extends { id: string }>(state: ScenarioState, instruction: ChooseInstruction, options: readonly Option[]): Option[] {
  if (!keepsTaken(instruction)) return [...options];
  const done = taken(state);
  return options.filter((option) => !done.includes(option.id));
}

/** Records that a `different` Choose took this option. */
export function noteOption(state: ScenarioState, instruction: ChooseInstruction, optionId: string): ScenarioState {
  const data = topFrame(state)?.data;
  if (!keepsTaken(instruction) || data?.kind !== "effect") return state;
  return patchTop(state, { data: { ...data, options: [...(data.options ?? []), optionId] } });
}

/** Whether a Choose with `upTo` has taken as many options as it may: the limit is read now, for the seat choosing. */
export function limitReached(state: ScenarioState, instruction: ChooseInstruction, seat: number, sourceId: string | null, ctx: ReduceContext): boolean {
  if (instruction.upTo == null) return false;
  const limit = typeof instruction.upTo === "number" ? instruction.upTo : resolveAmount(state, instruction.upTo, frameScope(state, seat, sourceId), ctx);
  return taken(state).length >= limit;
}

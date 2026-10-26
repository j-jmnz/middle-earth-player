// Rules: rr.the-word-choose (data/rules/entries.json).
//
// A Choose whose options may each be taken once in the effect ("Starting with the first player, each player chooses 1
// different option", The White Council 08010): the options taken are kept on the effect frame, and a later Choose of the
// same effect offers the others.
import type { Instruction } from "../../catalog/boundary.ts";

import type { ScenarioState } from "../state.ts";
import { patchTop, topFrame } from "../windows.ts";

type ChooseInstruction = Extract<Instruction, { verb: "Choose" }>;

function taken(state: ScenarioState): readonly string[] {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? (data.options ?? []) : [];
}

/** The options a Choose may offer now: for a `different` Choose, those this effect has not taken yet. */
export function untakenOptions<Option extends { id: string }>(state: ScenarioState, instruction: ChooseInstruction, options: readonly Option[]): Option[] {
  if (!instruction.different) return [...options];
  const done = taken(state);
  return options.filter((option) => !done.includes(option.id));
}

/** Records that a `different` Choose took this option. */
export function noteOption(state: ScenarioState, instruction: ChooseInstruction, optionId: string): ScenarioState {
  const data = topFrame(state)?.data;
  if (!instruction.different || data?.kind !== "effect") return state;
  return patchTop(state, { data: { ...data, options: [...(data.options ?? []), optionId] } });
}

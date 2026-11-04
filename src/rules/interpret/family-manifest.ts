// What a mechanic family adds to the rules: the runner of its verbs (docs/architecture.md, Mechanic families). Each
// src/rules/families/<family>/index.ts exports one `manifest`; src/rules/families/index.ts lists them in play order.
import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ScenarioState } from "../core/state.ts";
import type { ReduceContext } from "./interpret.ts";

/** The seat an instruction resolves for and the card whose effect it is. `chosen`: the target a player chose when the verb
 * asked for one (askTarget in choices.ts puts the instruction back with it). */
export type Focus = { seat: number; sourceId: string | null; chosen?: string };

/** Runs one instruction of its family's verbs, or returns null when the verb is not one of them. */
export type Runner = (state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]) => ScenarioState | null;

export type RulesFamily = {
  /** The folder name, which is also the catalog file name in src/catalog/families. */
  readonly name: string;
  /** Every verb `run` answers, so a test can check them against the verbs the catalog side declares. */
  readonly verbs: readonly Instruction["verb"][];
  readonly run: Runner;
};

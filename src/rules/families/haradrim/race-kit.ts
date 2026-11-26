// Test helper for Race Across Harad's family tests (orcs.test.ts, mumak.test.ts, stages.test.ts): the table of the scenario, the Orcs' area as the Setup leaves it, one record resolved in a frame of its card, the Orcs advanced to a stage.
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { opened, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

export const ORCS_STAGES = ["17051", "17052", "17053", "17054"];
export const CHIEFTAIN = "16061";
export const MUMAK = "17038";
export const URUK = "16062";
export const TREACHERY = "16051";

/** The scenario's table, the players at stage 2B by default, the Orcs' stages and the Chieftain set aside as the piles leave them. */
/** `effects` are the records the table runs (the authored ones by default): a line spec passes them without the records of its line. */
export const raceTable = (layout: Layout = {}, effects?: readonly Effect[]) => tableFromLayout("race-across-harad", { seats: 1, stage: "17048", setAside: [...ORCS_STAGES, CHIEFTAIN], ...layout }, effects ? { effects } : {});
export type RaceTable = ReturnType<typeof raceTable>;

const PREPARE: Instruction = { verb: "PrepareOrcsArea", stages: ORCS_STAGES, number: 1, place: [CHIEFTAIN] };

/** The table with the Orcs' area prepared as the Setup of stage 1A leaves it. */
export function prepared(layout: Layout = {}, effects?: readonly Effect[]): { made: RaceTable; state: ScenarioState } {
  const made = raceTable(layout, effects);
  return { made, state: runInstruction(made, opened(made).state, PREPARE) };
}

/** One record of the scenario resolves in an effect frame of the card `source`, as its trigger would, and the table settles. */
export function record(made: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState, id: string, source: string, frame: "forced" | "whenRevealed" | "shadow" | "travel" = "forced"): ScenarioState {
  const steps: EngineStep[] = [];
  const effects = made.ctx.effects.filter((effect) => effect.id === id);
  const pushed = pushCardEffects(state, frame, source, state.firstPlayer, false, effects, made.ctx, steps);
  return settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps);
}

/** The Orcs advance to stage `number` by placing the progress each stage needs (a stage with a When Revealed resolves it). */
export function advancedTo(made: RaceTable, state: ScenarioState, number: number): ScenarioState {
  let next = state;
  for (const [at, points] of [[1, 10], [2, 15], [3, 20]] as const) if (at < number) next = runInstruction(made, next, { verb: "AddOrcsProgress", amount: points });
  return next;
}

export const stageId = (state: ScenarioState): string => state.orcs?.stage ?? "";
export const codeOf = (state: ScenarioState, id: string): string | undefined => state.cards[id]?.code;

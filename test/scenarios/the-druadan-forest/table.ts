// Test helpers for The Drúadan Forest tests (src/rules/families/pelargir/druadan.test.ts, src/campaign/scenarios/the-druadan-forest/): a table of the scenario, an instruction run, a card's id and zone.
import type { Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";

import { tableFromLayout, type Layout, type LayoutTable } from "../../harness/scene-kit.ts";

export const SCENARIO = "the-druadan-forest";
export const CODES = {
  pursuit: "06042",
  untimelyEnd: "06043",
  passageOut: "06044",
  druBuriDru: "06045",
  drummer: "06046",
  elite: "06047",
  hunter: "06048",
  thief: "06049",
  clearing: "06050",
  garden: "06051",
  glade: "06052",
  menInDark: "06053",
  stars: "06054",
  leaves: "06055",
} as const;

/** A table of the scenario on stage 1 unless the layout names a stage; `effects` are the records it runs (every authored one by default). */
export const table = (layout: Layout, effects?: readonly Effect[], extra?: readonly string[]): LayoutTable =>
  tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? CODES.pursuit }, { ...(effects ? { effects } : {}), ...(extra ? { extra } : {}) });

/** The state after one instruction ran for the first seat (the window cleared first). */
export const run = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId }, made.ctx, []);

/** The state after the instruction ran and the frames it opened were settled. */
export const runSettled = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => settle(run(made, state, instruction, sourceId), made.ctx, []);

// Test helpers for the Encounter at Amon Dîn tests (src/rules/families/pelargir/amon-din.test.ts, src/campaign/scenarios/encounter-at-amon-din/): a table of the scenario, an instruction run, a card's id and tokens.
import type { Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { updateCard } from "../../../src/rules/core/state.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";

import { idOf, tableFromLayout, type Layout, type LayoutTable } from "../../harness/scene-kit.ts";

export const SCENARIO = "encounter-at-amon-din";
export const CODES = {
  savagery: "06066",
  protect: "06067",
  rescued: "06068",
  dead: "06069",
  alcaron: "06070",
  ghulat: "06071",
  marauding: "06072",
  ravager: "06073",
  eagle: "06074",
  farmhouse: "06075",
  hamlet: "06076",
  secluded: "06077",
  homestead: "06078",
  trapped: "06079",
  panicked: "06080",
} as const;

/** A table of the scenario on stage 1 unless the layout names a stage; `effects` are the records it runs (every authored one by default). */
export const table = (layout: Layout, effects?: readonly Effect[], extra?: readonly string[]): LayoutTable =>
  tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? CODES.savagery }, { ...(effects ? { effects } : {}), ...(extra ? { extra } : {}) });

/** The state after one instruction ran for the first seat (the window cleared first). */
export const run = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId }, made.ctx, []);

/** The state after the instruction ran and the frames it opened were settled. */
export const runSettled = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => settle(run(made, state, instruction, sourceId), made.ctx, []);

/** The villager tokens on the first card with this code (the card's resource tokens). */
export const villagers = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;

/** The damage tokens on the first card with this code. */
export const damageOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;

/** The state with this many villager tokens on the card with this code. */
export const withVillagers = (state: ScenarioState, code: string, amount: number): ScenarioState => updateCard(state, idOf(state, code), { resources: amount });

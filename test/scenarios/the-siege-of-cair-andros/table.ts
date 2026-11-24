// Test helpers for the Siege of Cair Andros tests (src/campaign/scenarios/the-siege-of-cair-andros/lines.test.ts, src/rules/families/pelargir/siege.test.ts): a table of the scenario, damage placed on a card and settled, an instruction run.
import type { Effect, Instruction } from "../../../src/catalog/boundary.ts";
import { UNATTRIBUTED } from "../../../src/rules/core/cause.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { placeDamage } from "../../../src/rules/core/keywords.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";

import { idOf, tableFromLayout, type Layout, type LayoutTable } from "../../harness/scene-kit.ts";

export const SCENARIO = "the-siege-of-cair-andros";
export const CODES = {
  citadel: "05033",
  approach: "05034",
  banks: "05035",
  defense: "05072",
  reinforcing: "05073",
  atApproach: "05074",
  atCitadel: "05075",
  lastBattle: "05076",
  lieutenant: "05056",
  arbalesters: "05057",
  vanguard: "05058",
  warCamp: "05059",
} as const;
export const THREE: readonly string[] = [CODES.citadel, CODES.approach, CODES.banks];

/** A table of the scenario on stage 1 unless the layout names a stage; `effects` are the records it runs (every authored one by default). */
export const table = (layout: Layout, effects?: readonly Effect[], extra?: readonly string[]): LayoutTable =>
  tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? CODES.defense }, { ...(effects ? { effects } : {}), ...(extra ? { extra } : {}) });

/** The state after one instruction of the table's records ran for the first seat (the window cleared first). */
export const run = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId }, made.ctx, []);

/** The code of a card by id. */
export const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);

/** Framework damage on the first card of a code, and the settle that follows (a location with its total is removed there). */
export function hurt(made: LayoutTable, code: string, amount: number, state: ScenarioState = made.state): ScenarioState {
  const steps: EngineStep[] = [];
  return settle(placeDamage({ ...state, window: null }, idOf(state, code), amount, made.ctx.cards, steps, "framework", UNATTRIBUTED), made.ctx, steps);
}

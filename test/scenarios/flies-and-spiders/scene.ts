// Test helper. Tables of Flies and Spiders built from data/ by the layout kit, for the poison family's tests (src/rules/families/poison) and the scenario's card tests (src/campaign/scenarios/flies-and-spiders). The heroes are the layout's stand-ins
// (6 hit points); a player deck of filler events gives the poison cards.
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";
import type { Instruction } from "../../../src/catalog/boundary.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { tableFromLayout } from "../../harness/scene-kit.ts";

export const SCENARIO = "flies-and-spiders";
export const STAGE_1 = "132067";
export const STAGE_2 = "132068";
export const STAGE_3 = "132069";
export const STAGE_4 = "132070";
export const GLADE = "132025";

export type SpiderLayout = NonNullable<Parameters<typeof tableFromLayout>[1]>;
/** A table at stage 1B with a player deck of `deck` filler events for each seat. */
export const spiderTable = (layout: SpiderLayout = {}) => {
  const table = tableFromLayout(SCENARIO, { stage: STAGE_1, phase: "Quest", deckOf: Array.from({ length: 12 }, () => "filler"), ...layout });
  return { ...table, state: syncConstants(table.state, table.ctx) };
};
export const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });
export const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);
/** Runs one instruction for a seat, then brings the constants up to date. */
export function run(table: { ctx: Parameters<typeof runInstruction>[3] }, state: ScenarioState, instruction: Instruction, seat = 0, sourceId: string | null = null): ScenarioState {
  return syncConstants(runInstruction(state, instruction, focus(seat, sourceId), table.ctx, []), table.ctx);
}

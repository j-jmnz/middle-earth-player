// The tables and helpers the audit files of The Blood of Gondor share (card-audit).

import type { Effect } from "../../../catalog/boundary.ts";

import { settle } from "../../../rules/engine/machine.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { idOf, opened, send, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

import { drive, hiddenCodes, table, BOROMIR } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

export const ALLY = "ally";
export const tableOf = (effects: readonly Effect[]) => (layout: Layout) => table(layout, effects, [BOROMIR]);
export const hiddenOf = (state: ScenarioState, seat: number): string[] => hiddenCodes(state, seat);
export const discardCodes = (state: ScenarioState): string[] => state.encounterDiscard.map((id) => state.cards[id]?.code ?? "");
export const stagingCodes = (state: ScenarioState): string[] => state.staging.map((id) => state.cards[id]?.code ?? "");

/** The refresh phase of the state runs to its end: the round is over and the first player token has passed. */
export const endOfRound = (made: ReturnType<typeof table>, state: ScenarioState): Run => opened(made, settle({ ...state, phase: "Refresh", boundaryPhase: "Refresh", mode: "refresh", window: null }, made.ctx, []));

/** The game goes on to the point where the combat phase offers its choice (the beginning of the combat phase of stage 1B). */
export function toCombatChoice(made: ReturnType<typeof table>, state: ScenarioState): Run {
  return drive(made, opened(made, state), (st) => st.window?.kind === "choose" && st.phase === "Combat");
}
export const choose = (made: ReturnType<typeof table>, run: Run, optionId: string): Run => send(run, { type: "Choose", optionId }, made.ctx);
/** The first player's seat engages the enemy with this code from the optional engagement window. */
export function engages(made: ReturnType<typeof table>, state: ScenarioState, code: string): Run {
  return drive(made, send(opened(made, state), { type: "Engage", enemyId: idOf(state, code) }, made.ctx), (st) => st.window?.kind !== "choose" && st.stack.length === 0);
}
export const inPlayOf = (state: ScenarioState, seat: number): string[] => (state.seats[seat]?.play ?? []).map((id) => state.cards[id]?.code ?? "");

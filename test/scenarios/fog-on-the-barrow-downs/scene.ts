// Test helper. The one trapped scene of Fog on the Barrow-downs: a table at stage 3B built from data/ by the layout kit, a Great Barrow revealed by the first player (who leaves for a stage 4A of his own), and the second trap. The verb tests
// (src/rules/families/breaking/barrow.test.ts, fog.test.ts) and the scenario's card tests (src/campaign/scenarios/fog-on-the-barrow-downs/split.test.ts) read it, so the scene is built in one place.
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { spawn } from "../../../src/rules/core/zones.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";
import { idOf, revealFromTop, tableFromLayout } from "../../harness/scene-kit.ts";

export const SCENARIO = "fog-on-the-barrow-downs";
export const STAGE_3 = "148003";
export const STAGE_4 = "148004";
export const GREAT_BARROW = "148007";
export const STANDING_STONES = "148006";
export const WIGHT = "148011";

export type FogLayout = NonNullable<Parameters<typeof tableFromLayout>[1]>;
export const fogTable = (layout: FogLayout = {}) => tableFromLayout(SCENARIO, { stage: STAGE_3, phase: "Quest", ...layout });
export const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });
export const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);
export const stopped = (state: ScenarioState): ScenarioState => ({ ...state, mode: "stopped", window: null });

// The data deals one stage 4A and the card is printed four times: the quest deck holds `copies` more.
export function withCopies(state: ScenarioState, copies: number): ScenarioState {
  let next = state;
  for (let copy = 0; copy < copies; copy += 1) next = spawn(next, STAGE_4, { zone: "questDeck" }).state;
  return next;
}

// Two players, seat 1 (the first player) trapped by a Great Barrow it revealed with a Barrow-wight on top of the encounter deck: seat 1 is at a stage 4A of its own, seat 0 stays at stage 3B. The quest phase stops where it is.
export function trapped(layout: FogLayout = {}) {
  const t = fogTable({ seats: 2, firstPlayer: 1, deck: [WIGHT], staging: ["148009"], ...layout });
  const revealed = revealFromTop(withCopies(t.state, 2), t.ctx, GREAT_BARROW, []);
  return { t, ...revealed };
}

// Both players trapped: seat 0 reveals a Great Barrow of its own after seat 1's, so stage 3B is parked.
export function bothTrapped() {
  const { t, state } = trapped();
  return { t, state: runInstruction(state, { verb: "SplitToOwnStage", code: STAGE_4 }, focus(0, idOf(state, GREAT_BARROW)), t.ctx, []) };
}

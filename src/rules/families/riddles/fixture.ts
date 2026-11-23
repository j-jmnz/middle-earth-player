// Test helper for the riddles family's tests: a table of Dungeons Deep and Caverns Dim with Bilbo Baggins and the riddle area its Setup makes, and the answers to the choices a riddle asks.
import type { Effect } from "../../../catalog/boundary.ts";
import { settle } from "../../engine/machine.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { idOf, resolveRecords, revealFromTop, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

export const ID = "dungeons-deep-and-caverns-dim";
// Player cards with a printed sphere, type and cost: Guard of the Citadel (leadership ally 2), Common Cause (leadership event 0), Grim Resolve (leadership event 5), Citadel Plate (tactics attachment 4), The Galadhrim's Greeting (spirit event 3), Stand and Fight (spirit event X).
export const PLAYER = ["01013", "01021", "01025", "01040", "01046", "01051"];

/** A table at the start of the quest phase (on `effects` when given: a line spec runs it without the records of its line) with the scenario's three quest cards, Lake in the Cavern staged, Bilbo Baggins as the first seat's hero, and the riddle area made by the Setup (the round stopped where it is). */
export function riddleTable(layout: Layout = {}, effects?: readonly Effect[]) {
  const made = tableFromLayout(ID, { stages: ["131029", "131030", "131031"], stage: "131029", deck: ["131074", "131079", "f0", "f0"], staging: ["131078"], ...layout }, { extra: ["131001", ...PLAYER], ...(effects ? { effects } : {}) });
  const bilbo = spawn(made.state, "131001", { zone: "heroes", seat: 0 });
  const setup = resolveRecords(bilbo.state, made.ctx, "131029", "setup", idOf(bilbo.state, "131029"));
  return { ...made, state: settle({ ...setup.state, window: null, mode: "stopped" }, made.ctx, []), bilbo: bilbo.id };
}
export type RiddleTable = ReturnType<typeof riddleTable>;

/** The encounter deck of the table in this order of codes, top first (the Setup shuffled it). */
export function stacked(state: ScenarioState, codes: readonly string[]): ScenarioState {
  const left = [...state.encounterDeck];
  const top = codes.map((code) => {
    const at = left.findIndex((id) => state.cards[id]?.code === code);
    return left.splice(at, 1)[0] ?? "";
  });
  return { ...state, encounterDeck: [...top, ...left] };
}

/** The card of this code is revealed from the top of the encounter deck for the first player, and each choice it opens is answered with the first of `picks` that is among its options (else the first option). */
export function revealAnswering(state: ScenarioState, ctx: RiddleTable["ctx"], code: string, picks: readonly string[]) {
  const steps: EngineStep[] = [];
  let run = { state: revealFromTop(state, ctx, code, steps).state, steps };
  const left = [...picks];
  for (let guard = 0; guard < 20 && run.state.window?.kind === "choose"; guard += 1) {
    const options = run.state.window.options;
    const wanted = left.find((pick) => options.includes(pick));
    if (wanted) left.splice(left.indexOf(wanted), 1);
    run = send(run, { type: "Choose", optionId: wanted ?? options[0] ?? "" }, ctx);
  }
  return run;
}

export const progressOf = (state: ScenarioState): number => state.cards[idOf(state, "131030")]?.progress ?? 0;
export const inDiscard = (state: ScenarioState, code: string): number => Object.values(state.cards).filter((card) => card.zone === "discard" && card.code === code).length;

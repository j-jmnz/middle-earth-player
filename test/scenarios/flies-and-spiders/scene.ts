// Test helper. Tables of Flies and Spiders built from data/ by the layout kit, for the poison family's tests (src/rules/families/poison) and the scenario's card tests (src/campaign/scenarios/flies-and-spiders). The heroes are the layout's stand-ins
// (6 hit points); a player deck of filler events gives the poison cards.
import type { GameEvent, ScenarioState } from "../../../src/rules/core/state.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { spawn } from "../../../src/rules/core/zones.ts";
import { stagingDest } from "../../../src/rules/families/breaking/areas.ts";
import { startReveal } from "../../../src/rules/windows/frames.ts";
import { fireForced } from "../../../src/rules/windows/triggers.ts";
import type { Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import { finish, legalIntents, resolveRecords, send, start, tableFromLayout, type Run } from "../../harness/scene-kit.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import type { PlayerIntent, ReduceContext } from "../../../src/rules/engine/reduce.ts";

export const SCENARIO = "flies-and-spiders";
export const STAGE_1 = "132067";
export const STAGE_2 = "132068";
export const STAGE_3 = "132069";
export const STAGE_4 = "132070";
export const GLADE = "132025";
/** Bilbo Baggins, the Baggins hero the loadout deals (the layout's stand-in heroes are Tactics). */
export const BILBO = "132001";

export type SpiderLayout = NonNullable<Parameters<typeof tableFromLayout>[1]>;
/** A table at stage 1B with a player deck of `deck` filler events for each seat. */
// `options.effects` are the records the table runs (a line test runs again without its line's records); `options.extra` are other cards of data/cards the layout places.
export const spiderTable = (layout: SpiderLayout = {}, options: NonNullable<Parameters<typeof tableFromLayout>[2]> = {}) => {
  const table = tableFromLayout(SCENARIO, { stage: STAGE_1, phase: "Quest", deckOf: Array.from({ length: 12 }, () => "filler"), ...layout }, { ...options, extra: [BILBO, ...(options.extra ?? [])] });
  return { ...table, state: syncConstants(table.state, table.ctx) };
};
export const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });
export const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);
/** Runs one instruction for a seat, then brings the constants up to date. */
export function run(table: { ctx: Parameters<typeof runInstruction>[3] }, state: ScenarioState, instruction: Instruction, seat = 0, sourceId: string | null = null): ScenarioState {
  return syncConstants(runInstruction(state, instruction, focus(seat, sourceId), table.ctx, []), table.ctx);
}

/** Bilbo Baggins joins the seat's heroes. */
export const withBilbo = (state: ScenarioState, seat = 0): { state: ScenarioState; id: string } => spawn(state, BILBO, { zone: "heroes", seat });
/** The table is settled from where it stands (a Refresh table runs its refresh phase), then every window is passed until the round counter moves on, or `guard` intents are sent. */
export function toNextRound(first: ScenarioState, ctx: ReduceContext, guard = 80): Run {
  const steps: EngineStep[] = [];
  const start: Run = { state: settle(first, ctx, steps), steps };
  let current = start;
  const round = first.round;
  for (let at = 0; at < guard && current.state.round === round && !current.state.lost; at += 1) {
    const next = legalIntents(current.state, ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage" || intent.type === "DeclineTravel");
    if (!next) break;
    current = send(current, next as PlayerIntent, ctx);
  }
  return current;
}

/** The table after stage 2B is revealed with two players: seat 0 alone at stage 3, seat 1 at stage 4 in the original area, which the Glade joined (the layout may add to it). */
export function splitTable(effects: readonly Effect[], layout: SpiderLayout = {}) {
  const t = spiderTable({ stage: STAGE_2, setAside: [GLADE], seats: 2, ...layout }, { effects });
  return { t, state: resolveRecords(t.state, t.ctx, STAGE_2, "whenRevealed", t.state.questStage ?? "").state };
}
/** A card of `code` is put in the staging area of the area `seat` heads. */
export function placeIn(state: ScenarioState, code: string, seat: number): { state: ScenarioState; id: string } {
  return spawn(state, code, stagingDest(state, seat));
}
/** The engine announces the event to the Forced effects, as a step of the game does, and the effects it opens are settled and answered with their first option. */
export function fire(ctx: ReduceContext, state: ScenarioState, event: GameEvent): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...state, window: null, mode: "stopped" }, event, ctx, steps), ctx, steps), steps }, ctx).state;
}
/** The card is revealed from the top of the encounter deck to the player `seat`, who reveals for his own area, and its effects settle. */
export function revealTo(ctx: ReduceContext, state: ScenarioState, code: string, seat: number): ScenarioState {
  const steps: EngineStep[] = [];
  const spawned = spawn({ ...state, window: null, mode: "stopped" }, code, { zone: "encounterDeck" }, "down");
  const top = { ...spawned.state, encounterDeck: [spawned.id, ...spawned.state.encounterDeck.filter((id) => id !== spawned.id)] };
  return finish({ state: settle(startReveal(top, seat, ctx, steps), ctx, steps), steps }, ctx).state;
}

/** The encounter phase of a table is played on until the defense window of the first attack opens (no defender declared yet); the state there. */
export function atDefense(table: { state: ScenarioState; ctx: ReduceContext }): ScenarioState {
  let run = send(start(table.state), { type: "DeclineEngage" }, table.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    const window = run.state.window;
    if (window?.kind === "chooseEnemy") run = send(run, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, table.ctx);
    else if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, table.ctx);
    else {
      const pass = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, table.ctx);
    }
  }
  if (run.state.window?.kind !== "defense") throw new Error(`no defense window: ${JSON.stringify(run.state.window)}`);
  return run.state;
}

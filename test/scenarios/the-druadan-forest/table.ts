// Test helpers for The Drúadan Forest tests (src/rules/families/pelargir/druadan.test.ts, src/campaign/scenarios/the-druadan-forest/): a table of the scenario, an instruction run, a card's id and zone.
import type { Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";

import { legalIntents, type PlayerIntent } from "../../../src/rules/engine/reduce.ts";
import { revealFromTop, send, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../harness/scene-kit.ts";

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

/** An answer to a choice the reveal opens: an option id, or a rule that picks one of the options. */
export type Answer = string | ((options: readonly string[]) => string);

/**
 * The card is revealed from the top of the encounter deck of `made` and the windows it opens are answered in turn by `answers` (a choice must offer the answer; one left unanswered throws). A response window is passed, unless a Response with the effect id `trigger` is offered: that one is used.
 * `asked` holds the options of each choice that was opened.
 */
export function revealPlay(made: LayoutTable, code: string, answers: readonly Answer[], trigger?: string): { run: Run; asked: string[][] } {
  let run: Run = { state: revealFromTop(made.state, made.ctx, code, []).state, steps: [] };
  const asked: string[][] = [];
  for (let guard = 0; guard < 60 && run.state.window; guard += 1) {
    const window = run.state.window;
    const used = window.kind === "response" ? legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === trigger) : undefined;
    if (used) run = send(run, used as PlayerIntent, made.ctx);
    else if (window.kind === "response" || window.kind === "pass") run = send(run, { type: "Pass" }, made.ctx);
    else if (window.kind === "choose") {
      asked.push([...window.options]);
      const next = answers[asked.length - 1];
      if (next === undefined) throw new Error(`Unanswered choice ${window.options.join("/")}`);
      const optionId = typeof next === "function" ? next(window.options) : next;
      if (!window.options.includes(optionId)) throw new Error(`The answer ${optionId} is not among ${window.options.join("/")}`);
      run = send(run, { type: "Choose", optionId }, made.ctx);
    } else break;
  }
  return { run, asked };
}

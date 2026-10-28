import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";

import * as attack from "./attack.ts";
import * as defense from "./defense.ts";
import * as encounter from "./encounter.ts";
import * as quest from "./quest.ts";
import * as play from "./play.ts";
import * as costs from "./costs.ts";
import * as deck from "./deck.ts";
import * as attachments from "./attachments.ts";
import * as sidequests from "./sidequests.ts";
import * as misc from "./misc.ts";
import * as burden from "./burden.ts";
import * as south from "./south.ts";
import * as campaign from "./campaign.ts";
import * as objectives from "./objectives.ts";
import * as prisoner from "./prisoner.ts";
import * as dungeon from "./dungeon.ts";

/** The seat an instruction resolves for and the card whose effect it is. `chosen`: the target a player chose when the verb
 * asked for one (askTarget in choices.ts puts the instruction back with it). */
export type Focus = { seat: number; sourceId: string | null; chosen?: string };

type Runner = (state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]) => ScenarioState | null;

const RUNNERS: readonly Runner[] = [attack.run, defense.run, encounter.run, quest.run, play.run, costs.run, deck.run, attachments.run, sidequests.run, misc.run, burden.run, south.run, campaign.run, objectives.run, prisoner.run, dungeon.run];

/** Runs a verb a mechanic family adds (src/catalog/families), or returns null when no family owns it. */
export function runFamilyVerb(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  for (const runner of RUNNERS) {
    const next = runner(state, instruction, focus, ctx, steps);
    if (next) return next;
  }
  return null;
}

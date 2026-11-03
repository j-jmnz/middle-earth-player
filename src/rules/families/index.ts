import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";

import * as attack from "./attack/index.ts";
import * as defense from "./defense/index.ts";
import * as encounter from "./encounter/index.ts";
import * as quest from "./quest/index.ts";
import * as play from "./play/index.ts";
import * as costs from "./costs/index.ts";
import * as deck from "./deck/index.ts";
import * as attachments from "./attachments/index.ts";
import * as sidequests from "./sidequests/index.ts";
import * as misc from "./misc/index.ts";
import * as burden from "./burden/index.ts";
import * as south from "./south/index.ts";
import * as campaign from "./campaign/index.ts";
import * as objectives from "./objectives/index.ts";
import * as prisoner from "./prisoner/index.ts";
import * as dungeon from "./dungeon/index.ts";
import * as caves from "./caves/index.ts";
import * as nightmare from "./nightmare/index.ts";
import * as moria from "./moria/index.ts";
import * as breaking from "./breaking/index.ts";
import * as dreamchaser from "./dreamchaser/index.ts";
import * as sea from "./sea/index.ts";
import * as uncharted from "./uncharted/index.ts";
import * as aflame from "./aflame/index.ts";
import * as stormcaller from "./stormcaller/index.ts";
import * as grapple from "./grapple/index.ts";
import * as island from "./island/index.ts";

/** The seat an instruction resolves for and the card whose effect it is. `chosen`: the target a player chose when the verb
 * asked for one (askTarget in choices.ts puts the instruction back with it). */
export type Focus = { seat: number; sourceId: string | null; chosen?: string };

type Runner = (state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]) => ScenarioState | null;

const RUNNERS: readonly Runner[] = [attack.run, defense.run, encounter.run, quest.run, play.run, costs.run, deck.run, attachments.run, sidequests.run, misc.run, burden.run, south.run, campaign.run, objectives.run, prisoner.run, dungeon.run, caves.run, nightmare.run, moria.run, breaking.run, dreamchaser.run, sea.run, uncharted.run, aflame.run, stormcaller.run, grapple.run, island.run];

/** Runs a verb a mechanic family adds (src/catalog/families), or returns null when no family owns it. */
export function runFamilyVerb(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  for (const runner of RUNNERS) {
    const next = runner(state, instruction, focus, ctx, steps);
    if (next) return next;
  }
  return null;
}
